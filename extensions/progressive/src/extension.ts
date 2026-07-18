import {
  initialize,
  MidiClip,
  MidiTrack,
  type ActivationContext,
  type ExtensionContext,
  type Handle,
  type NoteDescription,
} from "@ableton-extensions/sdk";

// The dialog UI is authored as standalone HTML and inlined as a string by esbuild.
import dialogHtml from "./interface.html";
import { generate, NOTE_NAMES, PROGRESSIONS, type Mode } from "./theory.js";

const COMMAND_ID = "progressive.generate";

/** One bar of 4/4, in beats. Used to bar-align the arrangement start. */
const BAR_BEATS = 4;
const VELOCITY = 90;

/** Built-in Live instruments offered as the auto-added default. */
const INSTRUMENTS = ["Drift", "Wavetable", "Operator", "Meld"] as const;

/** Distinct clip colours, one per progression group (packed 0xRRGGBB). */
const GROUP_COLORS = [
  0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0xb197fc, 0xf783ac, 0x63e6be,
];

/** What the dialog posts back. */
interface DialogResult {
  cancelled?: boolean;
  root: number;
  mode: Mode;
  progressionIds: string[];
  seventh: boolean;
  smart: boolean;
  direction: "up" | "down" | "random";
  register: "level" | "up" | "down" | "random";
  destination: "session" | "arrangement";
  lengthBeats: number; // clip length / chord duration, in beats
  instrument: string; // an INSTRUMENTS value, or "None"
}

/** Write a chord's notes/name/colour into a freshly created MIDI clip. */
function writeChord(
  clip: MidiClip<"1.0.0">,
  pitches: number[],
  name: string,
  durationBeats: number,
  color: number,
): number {
  clip.notes = pitches.map<NoteDescription>((pitch) => ({
    pitch,
    startTime: 0,
    duration: durationBeats,
    velocity: VELOCITY,
  }));
  clip.name = name;
  clip.looping = true;
  // The colour format isn't documented; never let it sink the clip.
  try {
    clip.color = color;
  } catch (err) {
    console.warn("Progressive: couldn't set clip colour.", err);
  }
  return clip.notes.length; // read back to confirm the notes persisted
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand(COMMAND_ID, (arg: unknown) => {
    // Fire-and-forget: the command callback is synchronous, the work is async.
    void run(context, arg as Handle).catch((err) => {
      console.error(
        "Progressive: failed to generate progressions:",
        err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : err,
      );
    });
  });

  context.ui.registerContextMenuAction(
    "MidiTrack",
    "Generate Progressions…",
    COMMAND_ID,
  );

  console.log("progressive extension activated.");
}

async function run(context: ExtensionContext<"1.0.0">, handle: Handle) {
  const track = context.getObjectFromHandle(handle, MidiTrack);
  const song = context.application.song;

  // Prefill the dialog from Live's currently selected scale.
  const defaults = {
    root: clampPitchClass(song.rootNote),
    mode: detectMode(song.scaleName),
    catalog: {
      major: PROGRESSIONS.major.map(({ id, label }) => ({ id, label })),
      minor: PROGRESSIONS.minor.map(({ id, label }) => ({ id, label })),
    },
    noteNames: NOTE_NAMES,
    instruments: [...INSTRUMENTS, "None"],
  };

  // Inject defaults as a plain JS literal. encodeURIComponent on the whole
  // document carries any Unicode through the data: URL intact; escaping "<"
  // keeps a stray "</script>" from ever breaking out (labels never contain it,
  // but this is cheap insurance). A function replacement avoids "$" in the JSON
  // being treated as a replacement pattern.
  const json = JSON.stringify(defaults).replace(/</g, "\\u003c");
  const html = dialogHtml.replace("__DEFAULTS_JSON__", () => json);
  const url = `data:text/html,${encodeURIComponent(html)}`;

  const raw = await context.ui.showModalDialog(url, 480, 600);
  if (!raw) return;
  const cfg = JSON.parse(raw) as DialogResult;
  if (cfg.cancelled) return;

  const groups = generate({
    root: cfg.root,
    mode: cfg.mode,
    progressionIds: cfg.progressionIds,
    seventh: cfg.seventh,
    smart: cfg.smart,
    direction: cfg.direction,
    register: cfg.register,
  });
  const totalChords = groups.reduce((n, g) => n + g.chords.length, 0);
  if (totalChords === 0) {
    console.log("Progressive: no progressions selected — nothing to generate.");
    return;
  }

  // Auto-add an instrument only when the track is empty, so we never sit one
  // behind an effect the user already placed.
  if (cfg.instrument !== "None" && track.devices.length === 0) {
    try {
      await track.insertDevice(cfg.instrument, 0);
    } catch (err) {
      console.warn(
        `Progressive: couldn't load "${cfg.instrument}" — add an instrument to the track yourself to hear the chords.`,
        err,
      );
    }
  }

  const durationBeats = cfg.lengthBeats > 0 ? cfg.lengthBeats : BAR_BEATS;

  // Flatten every chord into a single ordered list, tagged with its group's
  // colour and whether it starts a new progression (used for scene headers).
  const items = groups.flatMap((group, g) =>
    group.chords.map((chord) => ({
      chord,
      group,
      color: GROUP_COLORS[g % GROUP_COLORS.length],
      isGroupStart: chord.step === 0,
    })),
  );

  console.log(
    `Progressive: start — track "${track.name}", destination=${cfg.destination}, ` +
      `length=${durationBeats} beat(s); generating ${totalChords} chord clip(s) ` +
      `across ${groups.length} progression(s).`,
  );

  let created = 0;
  let notesWritten = 0;

  await context.ui.withinProgressDialog(
    "Generating progressions…",
    { progress: 0 },
    async (update, signal) => {
      // Arrangement: lay the chords end to end along the timeline, starting
      // after any existing clips on the track (bar-aligned).
      let cursor =
        cfg.destination === "arrangement" ? nextArrangementStart(track) : 0;

      for (const item of items) {
        if (signal.aborted) {
          console.log("Progressive: cancelled by user.");
          return;
        }
        const { chord, group, color, isGroupStart } = item;
        const name = `${chord.chordName} · ${chord.roman}`;
        let readBack: number;

        if (cfg.destination === "arrangement") {
          const clip = await track.createMidiClip(cursor, durationBeats);
          readBack = writeChord(clip, chord.pitches, name, durationBeats, color);
          cursor += durationBeats;
        } else {
          // Reuse the first empty slot so chords appear at the top of Session
          // view; only append a scene when none are free. Re-read each time to
          // avoid stale arrays.
          let index = track.clipSlots.findIndex((s) => s.clip === null);
          if (index === -1) {
            await song.createScene(-1);
            index = track.clipSlots.length - 1;
          }
          const slot = track.clipSlots[index];
          if (!slot) {
            throw new Error(
              `no clip slot to write into (slots=${track.clipSlots.length}, scenes=${song.scenes.length})`,
            );
          }
          const clip = await slot.createMidiClip(durationBeats);
          readBack = writeChord(clip, chord.pitches, name, durationBeats, color);

          // Name the first scene of each group as a header, but only if unnamed.
          if (isGroupStart) {
            const scene = song.scenes[index];
            if (scene && !scene.name) scene.name = group.label;
          }
        }

        notesWritten += readBack;
        created++;
        console.log(
          `Progressive: [${created}/${totalChords}] ${chord.chordName} (${chord.roman}) ` +
            `pitches=[${chord.pitches.join(", ")}] → clip.notes read back = ${readBack}`,
        );
        await update(
          `Writing ${chord.chordName}…`,
          Math.round((created / totalChords) * 100),
        );
      }
    },
  );

  const where =
    cfg.destination === "arrangement"
      ? "Open Arrangement view to see the chord clips along the timeline."
      : "Switch to Session view (press Tab) to see and launch the chord clips.";
  console.log(
    `Progressive: done — created ${created} clip(s), ${notesWritten} note(s) total. ${where}`,
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
