import {
  initialize,
  MidiTrack,
  type ActivationContext,
  type ExtensionContext,
  type Handle,
  type NoteDescription,
} from "@ableton-extensions/sdk";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// The dialog UI is authored as standalone HTML and inlined as a string by esbuild.
import dialogHtml from "./interface.html";
import { buildClips, buildGrid, NOTE_NAMES, VARIATIONS, type Mode, type SeqCell } from "./theory.js";

const COMMAND_ID = "chords.generate";

/** One bar of 4/4, in beats. Chords assumes 4/4 for its bar maths. */
const BAR_BEATS = 4;
const VELOCITY = 90;

/** Working state is saved here (in the extension's storage dir) so the dialog
 *  restores your sections when you reopen it. */
const STATE_FILE = "chords-state.json";

/** Built-in Live instruments offered as the auto-added default. */
const INSTRUMENTS = ["Drift", "Wavetable", "Operator", "Meld"] as const;

/** Distinct clip colours (packed 0xRRGGBB); one is picked per progression. */
const GROUP_COLORS = [
  0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0xb197fc, 0xf783ac, 0x63e6be,
];

/** A named section of chords, as the dialog stores it. */
interface Section {
  name: string;
  seq: SeqCell[];
}

/** The dialog's full working state — persisted, and posted back on close. */
interface DialogState {
  root: number;
  mode: Mode;
  smart: boolean;
  barBeats: number;
  instrument: string; // an INSTRUMENTS value, or "None"
  activeIndex: number;
  sections: Section[];
}

/** What the dialog posts back: the state plus which button closed it.
 *  - "generate": persist state and write clips
 *  - "save": persist state, no clips
 *  - "cancel": discard — persist nothing */
interface DialogResult extends DialogState {
  action: "generate" | "save" | "cancel";
}

/** Pick a stable colour for a progression from its name, so re-runs match. */
function colorFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

/** Path to the saved-state file. Prefers the extension's persistent storage
 *  dir, but the dev Extension Host often doesn't provide one, so fall back to
 *  the temp dir and finally the OS temp dir — always a writable location. */
function statePath(context: ExtensionContext<"1.0.0">): string {
  const dir =
    context.environment.storageDirectory || context.environment.tempDirectory || os.tmpdir();
  return path.join(dir, STATE_FILE);
}

/** Read the last saved working state, or null if none / unreadable. */
function loadState(context: ExtensionContext<"1.0.0">): DialogState | null {
  try {
    const p = statePath(context);
    if (!p || !fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as DialogState;
  } catch (err) {
    console.warn("Chords: couldn't read saved state — starting fresh.", err);
    return null;
  }
}

/** Persist the working state so reopening the dialog restores it. Best-effort. */
function saveState(context: ExtensionContext<"1.0.0">, state: DialogState) {
  try {
    const p = statePath(context);
    if (!p) return;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state), "utf8");
  } catch (err) {
    console.warn("Chords: couldn't save state.", err);
  }
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand(COMMAND_ID, (arg: unknown) => {
    // Fire-and-forget: the command callback is synchronous, the work is async.
    void run(context, arg as Handle).catch((err) => {
      console.error(
        "Chords: failed to generate chords:",
        err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : err,
      );
    });
  });

  context.ui.registerContextMenuAction("MidiTrack", "Map Chords…", COMMAND_ID);

  console.log("chords extension activated.");
}

async function run(context: ExtensionContext<"1.0.0">, handle: Handle) {
  const track = context.getObjectFromHandle(handle, MidiTrack);
  const song = context.application.song;

  // Restore the last session's work if we have it; otherwise prefill the key
  // from Live's currently selected scale.
  const saved = loadState(context);
  const defaults = {
    root: clampPitchClass(song.rootNote),
    mode: detectMode(song.scaleName),
    noteNames: NOTE_NAMES,
    variations: VARIATIONS.map(({ id, label }) => ({ id, label })),
    grid: { major: buildGrid("major"), minor: buildGrid("minor") },
    instruments: [...INSTRUMENTS, "None"],
    saved,
  };

  // Inject defaults as a plain JS literal. encodeURIComponent on the whole
  // document carries any Unicode through the data: URL intact; escaping "<"
  // keeps a stray "</script>" from ever breaking out. A function replacement
  // avoids "$" in the JSON being treated as a replacement pattern.
  const json = JSON.stringify(defaults).replace(/</g, "\\u003c");
  const html = dialogHtml.replace("__DEFAULTS_JSON__", () => json);
  const url = `data:text/html,${encodeURIComponent(html)}`;

  const raw = await context.ui.showModalDialog(url, 720, 510);
  if (!raw) return; // closed by the host without our buttons — nothing to save
  const cfg = JSON.parse(raw) as DialogResult;

  // Persist the working state on Save or Generate (so reopening restores it),
  // but not on Cancel — that discards this session's edits.
  if (cfg.action !== "cancel") {
    saveState(context, {
      root: cfg.root,
      mode: cfg.mode,
      smart: cfg.smart,
      barBeats: cfg.barBeats,
      instrument: cfg.instrument,
      activeIndex: cfg.activeIndex,
      sections: cfg.sections,
    });
  }

  if (cfg.action !== "generate") return;

  const section = cfg.sections[cfg.activeIndex] ?? cfg.sections[0];
  const cells = section ? section.seq : [];
  const barBeats = cfg.barBeats > 0 ? cfg.barBeats : BAR_BEATS;
  const chords = buildClips(cells, {
    mode: cfg.mode,
    root: cfg.root,
    barBeats,
    smart: cfg.smart,
  });
  if (chords.length === 0) {
    console.log("Chords: the selected section is empty — nothing to generate.");
    return;
  }

  // Auto-add an instrument only when the track is empty, so we never sit one
  // behind an effect the user already placed.
  if (cfg.instrument !== "None" && track.devices.length === 0) {
    try {
      await track.insertDevice(cfg.instrument, 0);
    } catch (err) {
      console.warn(
        `Chords: couldn't load "${cfg.instrument}" — add an instrument to the track yourself to hear the chords.`,
        err,
      );
    }
  }

  const label = (section?.name ?? "Progression").trim() || "Progression";
  const color = colorFor(label);

  // Lay the whole section out along one clip's timeline: each chord occupies its
  // span, one after another.
  let cursor = 0;
  const notes: NoteDescription[] = [];
  for (const chord of chords) {
    for (const pitch of chord.pitches) {
      notes.push({ pitch, startTime: cursor, duration: chord.durationBeats, velocity: VELOCITY });
    }
    cursor += chord.durationBeats;
  }
  const totalBeats = cursor;

  // Place the take on the Arrangement timeline, after any existing clips on the
  // track, bar-aligned so it starts cleanly.
  const start = nextArrangementStart(track);

  console.log(
    `Chords: start — track "${track.name}", section "${label}", ` +
      `${chords.length} chord(s) over ${totalBeats / BAR_BEATS} bar(s) into the Arrangement at beat ${start}.`,
  );

  const clip = await track.createMidiClip(start, totalBeats);
  clip.notes = notes;
  clip.name = label;
  try {
    clip.color = color;
  } catch (err) {
    console.warn("Chords: couldn't set clip colour.", err);
  }

  console.log(
    `Chords: done — wrote "${label}" (${clip.notes.length} note(s), ${totalBeats} beats) ` +
      `to the Arrangement at beat ${start}. Open Arrangement view to see it along the timeline.`,
  );
}

/** First bar-aligned beat after any existing arrangement clips on the track. */
function nextArrangementStart(track: MidiTrack<"1.0.0">): number {
  const clips = track.arrangementClips;
  if (clips.length === 0) return 0;
  const end = Math.max(...clips.map((c) => c.endTime));
  return Math.ceil(end / BAR_BEATS) * BAR_BEATS;
}

function clampPitchClass(n: number): number {
  return ((Math.round(n) % 12) + 12) % 12;
}

/** Live's scale name is a hint; default to major unless it clearly reads minor. */
function detectMode(scaleName: string | undefined): Mode {
  return scaleName && scaleName.toLowerCase().includes("minor") ? "minor" : "major";
}
