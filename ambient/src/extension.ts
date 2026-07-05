import {
  initialize,
  Device,
  MidiTrack,
  type ActivationContext,
  type ExtensionContext,
  type Handle,
  type NoteDescription,
  type Song,
} from "@ableton-extensions/sdk";

// The dialog UI is authored as standalone HTML and inlined as a string by esbuild.
import dialogHtml from "./interface.html";
import {
  generateAleatoric,
  generateBloom,
  generateDrift,
  MODES,
  NOTE_NAMES,
  performTrackCount,
  type AleaLength,
  type AleaWeight,
  type ChordKind,
  type ModeId,
  type MotionId,
  type SpreadId,
  type VoicingId,
} from "./theory.js";

const COMMAND_ID = "ambient.generate";

/** Built-in Live instruments offered as the auto-added default. */
const INSTRUMENTS = ["Drift", "Wavetable", "Operator", "Meld"] as const;

/** A calm default tempo for ambient work, offered as an opt-in. */
const AMBIENT_TEMPO = 70;

/** What the dialog posts back. */
interface DialogResult {
  cancelled?: boolean;
  tab: "drift" | "bloom" | "aleatoric" | "perform";
  root: number;
  mode: ModeId;
  instrument: string; // an INSTRUMENTS value, or "None"
  addFx: boolean;
  setTempo: boolean;
  drift: {
    layers: number;
    voices: number;
    voicing: VoicingId;
    spread: SpreadId;
    vary: boolean;
  };
  bloom: {
    layers: number;
    steps: number;
    motion: MotionId;
    chord: ChordKind;
    barsPerStep: number;
    vary: boolean;
  };
  aleatoric: {
    bars: number;
    density: number;
    spread: SpreadId;
    length: AleaLength;
    weight: AleaWeight;
    vary: boolean;
  };
  perform: {
    bedOn: boolean;
    bedLayers: number;
    bedVoicing: VoicingId;
    bedSpread: SpreadId;
    bloomOn: boolean;
    bloomSteps: number;
    bloomMotion: MotionId;
    bloomChord: ChordKind;
    shimmerOn: boolean;
    shimmerDensity: number;
    shimmerSpread: SpreadId;
    playOn: boolean;
    playInstrument: string;
    vary: boolean;
  };
}

/** Fixed shimmer settings in the Perform rig (kept off the panel for brevity). */
const PERFORM_SHIMMER_BARS = 8;
const PERFORM_SHIMMER_LENGTH: AleaLength = "long";
const PERFORM_SHIMMER_WEIGHT: AleaWeight = "chord";

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand(COMMAND_ID, (arg: unknown) => {
    // Fire-and-forget: the command callback is synchronous, the work is async.
    void run(context, arg as Handle).catch((err) => {
      console.error(
        "Ambient: failed to generate soundscape:",
        err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : err,
      );
    });
  });

  context.ui.registerContextMenuAction(
    "MidiTrack",
    "Generate Ambient…",
    COMMAND_ID,
  );

  console.log("ambient extension activated.");
}

async function run(context: ExtensionContext<"1.0.0">, handle: Handle) {
  const track = context.getObjectFromHandle(handle, MidiTrack);
  const song = context.application.song;

  // Prefill the dialog from Live's currently selected scale.
  const defaults = {
    root: clampPitchClass(song.rootNote),
    mode: detectMode(song.scaleName),
    modes: MODES.map(({ id, label }) => ({ id, label })),
    noteNames: NOTE_NAMES,
    instruments: [...INSTRUMENTS, "None"],
    tempo: AMBIENT_TEMPO,
  };

  // Inject defaults as a plain JS literal. Escaping "<" keeps a stray
  // "</script>" from ever breaking out; a function replacement avoids "$" in
  // the JSON being treated as a replacement pattern.
  const json = JSON.stringify(defaults).replace(/</g, "\\u003c");
  const html = dialogHtml.replace("__DEFAULTS_JSON__", () => json);
  const url = `data:text/html,${encodeURIComponent(html)}`;

  const raw = await context.ui.showModalDialog(url, 460, 700);
  if (!raw) return;
  const cfg = JSON.parse(raw) as DialogResult;
  if (cfg.cancelled) return;

  if (cfg.setTempo) {
    try {
      song.tempo = AMBIENT_TEMPO;
    } catch (err) {
      console.warn("Ambient: couldn't set tempo.", err);
    }
  }

  if (cfg.tab === "drift") {
    await runDrift(context, track, cfg);
  } else if (cfg.tab === "bloom") {
    await runBloom(context, track, cfg);
  } else if (cfg.tab === "aleatoric") {
    await runAleatoric(context, track, cfg);
  } else if (cfg.tab === "perform") {
    await runPerform(context, track, cfg);
  }
}

/**
 * Drift: lay out N looping clips of coprime bar lengths, one per track, all in a
 * single scene so they launch together and phase against each other endlessly.
 */
async function runDrift(
  context: ExtensionContext<"1.0.0">,
  anchor: MidiTrack<"1.0.0">,
  cfg: DialogResult,
) {
  const song = context.application.song;
  const layers = generateDrift({
    root: cfg.root,
    mode: cfg.mode,
    layers: cfg.drift.layers,
    voices: cfg.drift.voices,
    voicing: cfg.drift.voicing,
    spread: cfg.drift.spread,
    vary: cfg.drift.vary,
    seed: Math.floor(Math.random() * 1e9),
  });

  console.log(
    `Ambient/Drift: start — ${layers.length} layer(s), lengths ` +
      `[${layers.map((l) => l.bars).join(", ")}] bars, key=${NOTE_NAMES[cfg.root]} ${cfg.mode}.`,
  );

  let notesWritten = 0;

  await context.ui.withinProgressDialog(
    "Generating ambient drift…",
    { progress: 0 },
    async (update, signal) => {
      // The right-clicked track anchors layer 0; create fresh tracks for the
      // rest so the phasing loops can play simultaneously.
      const tracks: MidiTrack<"1.0.0">[] = [anchor];
      for (let i = 1; i < layers.length; i++) {
        if (signal.aborted) return;
        await update(`Adding track ${i + 1} of ${layers.length}…`, Math.round((i / layers.length) * 40));
        tracks.push(await song.createMidiTrack());
      }

      // One shared scene row for all layers, so a single scene launch starts
      // the whole texture. Reuse an empty row rather than always appending.
      const sceneIndex = await reserveScenes(song, tracks, 1);
      const scene = song.scenes[sceneIndex];
      if (scene && !scene.name) scene.name = "Ambient · Drift";

      for (let i = 0; i < layers.length; i++) {
        if (signal.aborted) {
          console.log("Ambient/Drift: cancelled by user.");
          return;
        }
        const layer = layers[i];
        const track = tracks[i];
        track.name = `Ambient ${layer.role}`;

        // Build an instrument + reverb/delay chain, but only on a track we
        // haven't been handed with the user's own devices already on it.
        if (track.devices.length === 0) {
          await buildAmbientChain(track, cfg.instrument, cfg.addFx);
        }

        const slot = track.clipSlots[sceneIndex];
        if (!slot) {
          throw new Error(
            `no clip slot for layer ${i} (slots=${track.clipSlots.length}, scenes=${song.scenes.length})`,
          );
        }
        const clip = await slot.createMidiClip(layer.bars * 4);
        clip.notes = layer.notes as NoteDescription[];
        clip.name = `${layer.role} · ${layer.bars} bars`;
        clip.looping = true;
        setColor(clip, layer.color);

        notesWritten += layer.notes.length;
        console.log(
          `Ambient/Drift: [${i + 1}/${layers.length}] ${layer.role} — ${layer.bars} bars, ` +
            `pitches=[${layer.notes.map((n) => n.pitch).join(", ")}].`,
        );
        await update(
          `Writing ${layer.role} layer…`,
          40 + Math.round(((i + 1) / layers.length) * 60),
        );
      }
    },
  );

  console.log(
    `Ambient/Drift: done — ${layers.length} looping layer(s), ${notesWritten} note(s). ` +
      `Switch to Session view (Tab) and launch the "Ambient · Drift" scene.`,
  );
}

/**
 * Bloom: an evolving chord progression laid out as one clip per scene on a
 * single track. Each scene holds one diatonic chord voiced wide across the
 * register; launch the scenes in turn (or use Live's scene follow) to walk the
 * pad through the harmony. The register "layers" become the vertical spread of
 * that one voicing rather than separate tracks.
 */
async function runBloom(
  context: ExtensionContext<"1.0.0">,
  anchor: MidiTrack<"1.0.0">,
  cfg: DialogResult,
) {
  const song = context.application.song;
  const result = generateBloom({
    root: cfg.root,
    mode: cfg.mode,
    layers: cfg.bloom.layers,
    steps: cfg.bloom.steps,
    motion: cfg.bloom.motion,
    chord: cfg.bloom.chord,
    barsPerStep: cfg.bloom.barsPerStep,
    vary: cfg.bloom.vary,
    seed: Math.floor(Math.random() * 1e9),
  });

  const clipBeats = result.barsPerStep * 4;
  // Merge the register layers into one chord per step.
  const stepNotes = result.stepLabels.map((_, s) => result.layers.flatMap((l) => l.clips[s]));

  console.log(
    `Ambient/Bloom: start — ${result.steps} step(s) on one track, ` +
      `motion=${cfg.bloom.motion}, chord=${cfg.bloom.chord}, key=${NOTE_NAMES[cfg.root]} ${cfg.mode}; ` +
      `steps [${result.stepLabels.join(" → ")}].`,
  );

  let notesWritten = 0;

  await context.ui.withinProgressDialog(
    "Generating ambient bloom…",
    { progress: 0 },
    async (update, signal) => {
      anchor.name = "Ambient Bloom";
      if (anchor.devices.length === 0) {
        await buildAmbientChain(anchor, cfg.instrument, cfg.addFx);
      }

      // Reserve `steps` consecutive scene rows, reusing empty ones.
      const base = await reserveScenes(song, [anchor], result.steps);

      for (let s = 0; s < result.steps; s++) {
        if (signal.aborted) {
          console.log("Ambient/Bloom: cancelled by user.");
          return;
        }
        const label = `Bloom ${s + 1} · ${result.stepLabels[s]}`;
        const slot = anchor.clipSlots[base + s];
        if (!slot) {
          throw new Error(
            `no clip slot for step ${s} (slots=${anchor.clipSlots.length}, scenes=${song.scenes.length})`,
          );
        }
        const notes = stepNotes[s];
        const clip = await slot.createMidiClip(clipBeats);
        clip.notes = notes as NoteDescription[];
        clip.name = label;
        clip.looping = true;
        // Colour scenes distinctly so the progression reads at a glance.
        setColor(clip, result.layers[s % result.layers.length].color);

        const scene = song.scenes[base + s];
        if (scene && !scene.name) scene.name = label;

        notesWritten += notes.length;
        await update(`Writing step ${s + 1} of ${result.steps}…`, Math.round(((s + 1) / result.steps) * 100));
      }
    },
  );

  console.log(
    `Ambient/Bloom: done — ${result.steps} clip(s) on "Ambient Bloom", ${notesWritten} note(s). ` +
      `Switch to Session view (Tab); launch the "Bloom" scenes top to bottom.`,
  );
}

/**
 * Aleatoric: one long clip filled with probability-scattered notes — a
 * self-contained generative shimmer on a single track. With Evolve on, the
 * phrase re-shuffles every loop via per-note probability.
 */
async function runAleatoric(
  context: ExtensionContext<"1.0.0">,
  anchor: MidiTrack<"1.0.0">,
  cfg: DialogResult,
) {
  const song = context.application.song;
  const a = cfg.aleatoric;
  const notes = generateAleatoric({
    root: cfg.root,
    mode: cfg.mode,
    bars: a.bars,
    density: a.density,
    spread: a.spread,
    length: a.length,
    weight: a.weight,
    vary: a.vary,
    seed: Math.floor(Math.random() * 1e9),
  });

  console.log(
    `Ambient/Aleatoric: start — ${notes.length} note(s) over ${a.bars} bar(s), ` +
      `density=${a.density}/bar, weight=${a.weight}, key=${NOTE_NAMES[cfg.root]} ${cfg.mode}.`,
  );

  await context.ui.withinProgressDialog(
    "Generating ambient shimmer…",
    { progress: 0 },
    async (update, signal) => {
      anchor.name = "Ambient Shimmer";
      if (anchor.devices.length === 0) {
        await buildAmbientChain(anchor, cfg.instrument, cfg.addFx);
      }
      if (signal.aborted) return;
      await update("Writing clip…", 50);

      const base = await reserveScenes(song, [anchor], 1);
      const slot = anchor.clipSlots[base];
      if (!slot) throw new Error(`no clip slot at scene ${base}`);
      const clip = await slot.createMidiClip(a.bars * 4);
      clip.notes = notes as NoteDescription[];
      clip.name = `Shimmer · ${a.bars} bars`;
      clip.looping = true;
      setColor(clip, 0x66d9e8);
      const scene = song.scenes[base];
      if (scene && !scene.name) scene.name = "Ambient · Shimmer";
      await update("Done", 100);
    },
  );

  console.log(
    `Ambient/Aleatoric: done — ${notes.length} note(s) on "Ambient Shimmer". ` +
      `Switch to Session view (Tab) and launch the clip.`,
  );
}

/**
 * Perform: assemble a Push-ready rig in one pass — a Drift phasing bed (one
 * track per layer), a Bloom chord progression (one track), and an armed play
 * instrument to improvise on. Everything shares the current key and fits Push's
 * 8-column grid.
 *
 * Layout for hands-on play: the bed clips and Bloom step 1 sit together in the
 * first scene, so launching it starts the drone and the first chord at once.
 * The remaining Bloom steps run down that track's column; you advance the
 * harmony by tapping those pads (clip launch, not scene launch), which leaves
 * the bed untouched. The play track stays empty — it's just for playing.
 */
async function runPerform(
  context: ExtensionContext<"1.0.0">,
  anchor: MidiTrack<"1.0.0">,
  cfg: DialogResult,
) {
  const song = context.application.song;
  const p = cfg.perform;
  const seed = Math.floor(Math.random() * 1e9);

  const bed = p.bedOn
    ? generateDrift({
        root: cfg.root,
        mode: cfg.mode,
        layers: p.bedLayers,
        voices: 3,
        voicing: p.bedVoicing,
        spread: p.bedSpread,
        vary: p.vary,
        seed,
      })
    : [];
  const bloom = p.bloomOn
    ? generateBloom({
        root: cfg.root,
        mode: cfg.mode,
        layers: 3,
        steps: p.bloomSteps,
        motion: p.bloomMotion,
        chord: p.bloomChord,
        barsPerStep: 4,
        vary: p.vary,
        seed,
      })
    : null;
  const shimmer = p.shimmerOn
    ? generateAleatoric({
        root: cfg.root,
        mode: cfg.mode,
        bars: PERFORM_SHIMMER_BARS,
        density: p.shimmerDensity,
        spread: p.shimmerSpread,
        length: PERFORM_SHIMMER_LENGTH,
        weight: PERFORM_SHIMMER_WEIGHT,
        vary: p.vary,
        seed,
      })
    : null;

  const sceneCount = Math.max(1, bloom ? bloom.steps : 1);
  console.log(
    `Ambient/Perform: start — key=${NOTE_NAMES[cfg.root]} ${cfg.mode}; ` +
      `bed=${bed.length} layer(s), bloom=${bloom ? bloom.steps + " step(s)" : "off"}, ` +
      `shimmer=${shimmer ? "on" : "off"}, play=${p.playOn ? p.playInstrument : "off"}; ` +
      `${performTrackCount(p.bedOn, p.bedLayers, p.bloomOn, p.shimmerOn, p.playOn)} track(s).`,
  );

  let notesWritten = 0;

  await context.ui.withinProgressDialog(
    "Building ambient performance rig…",
    { progress: 0 },
    async (update, signal) => {
      // Bed tracks (the anchor becomes the first), then the Bloom track, then
      // the play track. All are gathered so we can reserve empty scene rows
      // spanning every one of them.
      const bedTracks: MidiTrack<"1.0.0">[] = [];
      const allTracks: MidiTrack<"1.0.0">[] = [];
      let usedAnchor = false;
      const nextTrack = async () => {
        if (!usedAnchor) {
          usedAnchor = true;
          return anchor;
        }
        return song.createMidiTrack();
      };

      await update("Creating tracks…", 10);
      for (let i = 0; i < bed.length; i++) {
        if (signal.aborted) return;
        const t = await nextTrack();
        bedTracks.push(t);
        allTracks.push(t);
      }
      const bloomTrack = bloom ? await nextTrack() : null;
      if (bloomTrack) allTracks.push(bloomTrack);
      const shimmerTrack = shimmer ? await nextTrack() : null;
      if (shimmerTrack) allTracks.push(shimmerTrack);
      const playTrack = p.playOn ? await nextTrack() : null;
      if (playTrack) allTracks.push(playTrack);
      if (allTracks.length === 0) return;

      const base = await reserveScenes(song, allTracks, sceneCount);

      // Bed: each layer's sustained loop, all in the first reserved scene.
      await update("Writing bed…", 35);
      for (let i = 0; i < bed.length; i++) {
        if (signal.aborted) return;
        const layer = bed[i];
        const track = bedTracks[i];
        track.name = `Ambient ${layer.role}`;
        if (track.devices.length === 0) await buildAmbientChain(track, cfg.instrument, cfg.addFx);
        const slot = track.clipSlots[base];
        if (!slot) throw new Error(`no bed slot at scene ${base}`);
        const clip = await slot.createMidiClip(layer.bars * 4);
        clip.notes = layer.notes as NoteDescription[];
        clip.name = `${layer.role} · ${layer.bars} bars`;
        clip.looping = true;
        setColor(clip, layer.color);
        notesWritten += layer.notes.length;
      }

      // Bloom: the progression down the Bloom track's column.
      if (bloom && bloomTrack) {
        await update("Writing progression…", 60);
        bloomTrack.name = "Ambient Bloom";
        if (bloomTrack.devices.length === 0) await buildAmbientChain(bloomTrack, cfg.instrument, cfg.addFx);
        for (let s = 0; s < bloom.steps; s++) {
          if (signal.aborted) return;
          const notes = bloom.layers.flatMap((l) => l.clips[s]);
          const slot = bloomTrack.clipSlots[base + s];
          if (!slot) throw new Error(`no bloom slot at scene ${base + s}`);
          const label = `Bloom ${s + 1} · ${bloom.stepLabels[s]}`;
          const clip = await slot.createMidiClip(bloom.barsPerStep * 4);
          clip.notes = notes as NoteDescription[];
          clip.name = label;
          clip.looping = true;
          setColor(clip, bloom.layers[s % bloom.layers.length].color);
          const scene = song.scenes[base + s];
          if (scene && !scene.name) scene.name = s === 0 ? "Ambient · start" : label;
          notesWritten += notes.length;
        }
      } else {
        const scene = song.scenes[base];
        if (scene && !scene.name) scene.name = "Ambient · start";
      }

      // Shimmer: one long probabilistic clip in the first scene, so it launches
      // together with the bed and first chord.
      if (shimmer && shimmerTrack) {
        await update("Writing shimmer…", 78);
        shimmerTrack.name = "Ambient Shimmer";
        if (shimmerTrack.devices.length === 0) await buildAmbientChain(shimmerTrack, cfg.instrument, cfg.addFx);
        const slot = shimmerTrack.clipSlots[base];
        if (!slot) throw new Error(`no shimmer slot at scene ${base}`);
        const clip = await slot.createMidiClip(PERFORM_SHIMMER_BARS * 4);
        clip.notes = shimmer as NoteDescription[];
        clip.name = `Shimmer · ${PERFORM_SHIMMER_BARS} bars`;
        clip.looping = true;
        setColor(clip, 0x66d9e8);
        notesWritten += shimmer.length;
      }

      // Play track: instrument + FX, armed and empty — ready for Push Note mode.
      if (playTrack) {
        await update("Arming play track…", 85);
        playTrack.name = "Ambient Play";
        if (playTrack.devices.length === 0) await buildAmbientChain(playTrack, p.playInstrument, cfg.addFx);
        try {
          playTrack.arm = true;
        } catch (err) {
          console.warn("Ambient: couldn't arm the play track.", err);
        }
      }

      await update("Done", 100);
    },
  );

  console.log(
    `Ambient/Perform: done — ${notesWritten} note(s). Launch the first scene to start the bed` +
      `${bloom ? " + first chord, then tap down the Bloom column to move the harmony" : ""}. ` +
      `Select "Ambient Play" on Push and hit Note mode to play over it in ${NOTE_NAMES[cfg.root]} ${cfg.mode}.`,
  );
}

/** Set a clip colour without ever letting the (undocumented) format sink it. */
function setColor(clip: { color: number }, color: number) {
  try {
    clip.color = color;
  } catch (err) {
    console.warn("Ambient: couldn't set clip colour.", err);
  }
}

/**
 * Find `count` consecutive scene rows that are empty across every one of
 * `tracks`, so we write into existing space instead of piling fresh scenes at
 * the bottom on every run. Reuses the first empty run anywhere; if none fits,
 * reuses the empty tail and appends only the shortfall. Returns the starting
 * scene index.
 */
async function reserveScenes(
  song: Song<"1.0.0">,
  tracks: MidiTrack<"1.0.0">[],
  count: number,
): Promise<number> {
  const rowEmpty = (idx: number) =>
    tracks.every((t) => {
      const slot = t.clipSlots[idx];
      return !!slot && slot.clip === null;
    });

  // Reuse the first run of `count` consecutive empty rows anywhere.
  for (let start = 0; start + count <= song.scenes.length; start++) {
    let ok = true;
    for (let k = 0; k < count; k++) {
      if (!rowEmpty(start + k)) {
        ok = false;
        break;
      }
    }
    if (ok) return start;
  }

  // Otherwise reuse the empty tail and append only the missing rows.
  let tail = song.scenes.length;
  while (tail > 0 && rowEmpty(tail - 1)) tail--;
  const missing = count - (song.scenes.length - tail);
  for (let k = 0; k < missing; k++) await song.createScene(-1);
  return tail;
}

/**
 * Insert an instrument followed by a reverb + delay, tuned wetter than their
 * defaults so a launched clip already sounds like ambient rather than a dry
 * synth. Everything here is best-effort: a missing device or unnamed parameter
 * must never sink the generation.
 */
async function buildAmbientChain(
  track: MidiTrack<"1.0.0">,
  instrument: string,
  addFx: boolean,
) {
  if (instrument !== "None") {
    try {
      await track.insertDevice(instrument, track.devices.length);
    } catch (err) {
      console.warn(
        `Ambient: couldn't load "${instrument}" — add an instrument yourself to hear the layer.`,
        err,
      );
    }
  }

  if (!addFx) return;

  const reverb = await insertDeviceSafely(track, "Reverb");
  if (reverb) await tuneParam(reverb, "Dry/Wet", 0.5);

  const delay = await insertDeviceSafely(track, "Delay");
  if (delay) await tuneParam(delay, "Dry/Wet", 0.28);
}

async function insertDeviceSafely(
  track: MidiTrack<"1.0.0">,
  deviceName: string,
): Promise<Device<"1.0.0"> | null> {
  try {
    return await track.insertDevice(deviceName, track.devices.length);
  } catch (err) {
    console.warn(`Ambient: couldn't add "${deviceName}".`, err);
    return null;
  }
}

/**
 * Set a device parameter chosen by (case-insensitive) name to a fraction of its
 * range. Parameter names aren't part of the SDK contract, so failures are
 * swallowed — the device still loads with its default preset.
 */
async function tuneParam(device: Device<"1.0.0">, nameIncludes: string, frac: number) {
  try {
    const needle = nameIncludes.toLowerCase();
    const param = device.parameters.find((p) => p.name.toLowerCase().includes(needle));
    if (!param) return;
    const value = param.min + (param.max - param.min) * frac;
    await param.setValue(value);
  } catch (err) {
    console.warn(`Ambient: couldn't tune "${nameIncludes}" on ${device.name}.`, err);
  }
}

function clampPitchClass(n: number): number {
  return ((Math.round(n) % 12) + 12) % 12;
}

/** Map Live's current scale name onto one of our ambient modes. */
function detectMode(scaleName: string | undefined): ModeId {
  const s = (scaleName ?? "").toLowerCase();
  if (s.includes("lydian")) return "lydian";
  if (s.includes("mixolydian")) return "mixolydian";
  if (s.includes("dorian")) return "dorian";
  if (s.includes("phrygian")) return "phrygian";
  if (s.includes("pentatonic")) return s.includes("minor") ? "minPentatonic" : "majPentatonic";
  if (s.includes("major") || s.includes("ionian")) return "ionian";
  if (s.includes("minor") || s.includes("aeolian")) return "aeolian";
  return "aeolian"; // a safe, calm default
}
