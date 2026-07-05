/**
 * Music theory for Ambient.
 *
 * Pure functions only — no SDK imports — so the generative maths can be
 * unit-tested outside Live and shared verbatim with the dialog UI (mode and
 * option lists are injected into the HTML so what the user sees matches what
 * gets generated).
 *
 * Pitch convention: MIDI note numbers, where 60 = C3 (Ableton's middle C).
 */

/** One bar of 4/4, in beats. Ambient lives in slow, wide clips. */
export const BEATS_PER_BAR = 4;

/** Note names indexed by pitch class (0 = C). Sharps; good enough for v1. */
export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/**
 * Modes worth reaching for in ambient music, ordered brightest → darkest.
 * Lydian floats, Dorian is warm-minor, Phrygian is dark; the two pentatonics
 * have no semitone clashes, so every note lands — ideal for generative layers.
 */
export type ModeId =
  | "lydian"
  | "ionian"
  | "mixolydian"
  | "dorian"
  | "aeolian"
  | "phrygian"
  | "majPentatonic"
  | "minPentatonic";

export interface ModeDef {
  id: ModeId;
  label: string;
  /** Semitone offsets of each scale degree from the root. */
  intervals: number[];
}

export const MODES: ModeDef[] = [
  { id: "lydian", label: "Lydian (floating)", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: "ionian", label: "Ionian (major)", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: "mixolydian", label: "Mixolydian (warm)", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: "dorian", label: "Dorian (minor, hopeful)", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: "aeolian", label: "Aeolian (natural minor)", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: "phrygian", label: "Phrygian (dark)", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: "majPentatonic", label: "Major pentatonic", intervals: [0, 2, 4, 7, 9] },
  { id: "minPentatonic", label: "Minor pentatonic", intervals: [0, 3, 5, 7, 10] },
];

export function modeIntervals(mode: ModeId): number[] {
  const def = MODES.find((m) => m.id === mode);
  return def ? def.intervals : MODES[0].intervals;
}

// --- Small deterministic RNG -------------------------------------------------

/**
 * mulberry32 — a tiny seeded PRNG. Deterministic so the same seed reproduces a
 * texture exactly, which also makes the generator unit-testable.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Phasing lengths ---------------------------------------------------------

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Loop lengths (in bars) for the layers of a Drift patch. Drawn from primes so
 * every pair is coprime: the loops realign only after the product of their
 * lengths, so a handful of short clips never repeat their combined state for
 * hours. This is the Music-for-Airports trick, in bars.
 */
const PHASING_PRIMES = [3, 5, 7, 11, 13, 17, 19, 23];

export function coprimeLengths(count: number): number[] {
  return PHASING_PRIMES.slice(0, Math.max(1, Math.min(count, PHASING_PRIMES.length)));
}

// --- Scale snapping & voicings -----------------------------------------------

/** Pitch classes (0–11) present in the scale. */
export function scalePitchClasses(root: number, mode: ModeId): Set<number> {
  return new Set(modeIntervals(mode).map((iv) => (((root + iv) % 12) + 12) % 12));
}

/** Nearest MIDI pitch to `pitch` whose pitch class is in the scale. */
export function snapToScale(pitch: number, root: number, mode: ModeId): number {
  const pcs = scalePitchClasses(root, mode);
  for (let d = 0; d <= 6; d++) {
    if (pcs.has((((pitch + d) % 12) + 12) % 12)) return pitch + d;
    if (pcs.has((((pitch - d) % 12) + 12) % 12)) return pitch - d;
  }
  return pitch; // scale always has a member within 6 semitones
}

export type VoicingId = "fifths" | "quartal" | "scale";

/** Semitone step stacked between successive voices, per voicing style. */
const VOICING_STEP: Record<Exclude<VoicingId, "scale">, number> = {
  fifths: 7, // open perfect fifths — the classic drone
  quartal: 5, // stacked fourths — modern, unresolved
};

/**
 * Build a `voices`-note chord around `center`, snapped into the key.
 *
 * - `fifths` / `quartal` stack their interval upward from the centre, so the
 *   voicing stays open and low-clash — exactly what wide ambient pads want.
 * - `scale` walks outward through adjacent scale degrees for a denser cluster.
 */
export function buildVoicing(
  center: number,
  voices: number,
  voicing: VoicingId,
  root: number,
  mode: ModeId,
): number[] {
  const base = snapToScale(center, root, mode);
  const out = new Set<number>([base]);

  if (voicing === "scale") {
    // Alternate above/below the centre along the scale.
    let step = 1;
    let dir = 1;
    while (out.size < voices) {
      out.add(snapToScale(base + dir * step, root, mode));
      if (dir === 1) dir = -1;
      else {
        dir = 1;
        step++;
      }
      if (step > 8) break;
    }
  } else {
    const inc = VOICING_STEP[voicing];
    for (let i = 1; i < voices; i++) {
      out.add(snapToScale(base + i * inc, root, mode));
    }
  }
  return [...out].sort((a, b) => a - b);
}

// --- Drift generator ---------------------------------------------------------

/** A single note in a generated clip. Shaped to assign to the SDK's NoteDescription. */
export interface DriftNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
  /** 0–1 chance this note sounds on any given loop (Live's per-note probability). */
  probability?: number;
  /** Random ± spread applied to velocity each loop, for a breathing dynamic. */
  velocityDeviation?: number;
}

export interface DriftLayer {
  /** Register role, e.g. "Drone", "Pad", "Air" — used to name the clip/track. */
  role: string;
  /** Loop length in bars (coprime across layers → endless phasing). */
  bars: number;
  /** Packed 0xRRGGBB clip colour. */
  color: number;
  notes: DriftNote[];
}

export type SpreadId = "narrow" | "wide" | "full";

/** MIDI centre range each spread distributes its layers across. */
const SPREADS: Record<SpreadId, [number, number]> = {
  narrow: [48, 67], // C3–G4, close and warm
  wide: [40, 76], // E2–E5
  full: [31, 84], // G1–C6, sub to air
};

/** Cool ambient palette, low register → high. */
const LAYER_COLORS = [
  0x3b5bdb, 0x1971c2, 0x0c8599, 0x099268, 0x2f9e44, 0x9c6ade, 0x5f3dc4, 0x6741d9,
];

function roleFor(center: number): string {
  if (center < 40) return "Sub";
  if (center < 52) return "Drone";
  if (center < 64) return "Pad";
  if (center < 76) return "Upper";
  return "Air";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface DriftOptions {
  root: number; // 0–11
  mode: ModeId;
  /** Number of phasing layers (each its own track). */
  layers: number;
  /** Chord tones per layer. */
  voices: number;
  voicing: VoicingId;
  spread: SpreadId;
  /** When true, notes get per-note probability + velocity drift so the texture
   *  never repeats. When false, every note sounds every loop (a fixed pad). */
  vary: boolean;
  seed: number;
}

/**
 * Turn Drift options into a set of layers, one per track. Each layer is a
 * sustained voicing on a coprime-length loop; with `vary` on, per-note
 * probability makes chord tones fade in and out so the harmony shimmers.
 */
export function generateDrift(opts: DriftOptions): DriftLayer[] {
  const n = Math.max(1, opts.layers);
  const bars = coprimeLengths(n);
  const [lo, hi] = SPREADS[opts.spread];
  const rng = mulberry32(opts.seed);

  const layers: DriftLayer[] = [];
  for (let i = 0; i < n; i++) {
    const center = Math.round(n === 1 ? lo : lerp(lo, hi, i / (n - 1)));
    const registerT = (center - 31) / (84 - 31); // 0 (low) → 1 (high)

    // Louder and steadier low, softer and more probabilistic up high.
    const baseVel = Math.round(clamp(78 - registerT * 30, 40, 90));
    const layerProb = opts.vary ? clamp(1 - registerT * 0.4, 0.55, 1) : 1;
    const barBeats = bars[i] * BEATS_PER_BAR;

    const pitches = buildVoicing(center, opts.voices, opts.voicing, opts.root, opts.mode);
    const notes: DriftNote[] = pitches.map((pitch) => {
      const note: DriftNote = {
        pitch,
        startTime: 0,
        duration: barBeats, // sustain the whole loop
        velocity: baseVel,
      };
      if (opts.vary) {
        // Jitter probability a touch per note so tones don't switch in lockstep.
        note.probability = clamp(layerProb - rng() * 0.15, 0.4, 1);
        note.velocityDeviation = 8;
      }
      return note;
    });

    layers.push({
      role: roleFor(center),
      bars: bars[i],
      color: LAYER_COLORS[i % LAYER_COLORS.length],
      notes,
    });
  }
  return layers;
}

// --- Bloom generator ---------------------------------------------------------

/** Pitch class of a scale degree, where `degree` may be any integer (wraps with octaves). */
export function scaleDegreePc(root: number, mode: ModeId, degree: number): number {
  const iv = modeIntervals(mode);
  const n = iv.length;
  const idx = ((degree % n) + n) % n;
  return ((((root + iv[idx]) % 12) + 12) % 12);
}

export type ChordKind = "triad" | "quartal" | "add9";

/**
 * Pitch classes of a diatonic chord built on scale `degree`. Everything is
 * stacked out of the current scale, so whatever the mode, the chord stays in
 * key: triads stack scale thirds, quartals stack scale fourths, add9 adds the
 * ninth (the second, an octave up — same pitch class).
 */
export function chordPitchClasses(
  root: number,
  mode: ModeId,
  degree: number,
  kind: ChordKind,
): number[] {
  const at = (step: number) => scaleDegreePc(root, mode, degree + step);
  let steps: number[];
  if (kind === "quartal") steps = [0, 3, 6];
  else if (kind === "add9") steps = [0, 2, 4, 1];
  else steps = [0, 2, 4];
  return [...new Set(steps.map(at))];
}

/**
 * Voice a chord (given as pitch classes) as the `voices` pitches nearest a
 * register centre. Low layers land on the low chord tones, high layers on the
 * high ones — the register does the spacing.
 */
export function voiceChordInRegister(
  chordPCs: number[],
  center: number,
  voices: number,
): number[] {
  const candidates: number[] = [];
  for (const pc of chordPCs) {
    for (let oct = 1; oct <= 8; oct++) candidates.push(pc + oct * 12);
  }
  candidates.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
  const picked: number[] = [];
  for (const p of candidates) {
    if (picked.includes(p)) continue;
    picked.push(p);
    if (picked.length >= voices) break;
  }
  return picked.sort((a, b) => a - b);
}

export type MotionId = "rise" | "fall" | "wave" | "random";

/** Scale-degree offset of the chord root at each step, per motion shape. */
export function motionOffsets(motion: MotionId, steps: number, seed: number): number[] {
  const out: number[] = [];
  if (motion === "rise") for (let i = 0; i < steps; i++) out.push(i);
  else if (motion === "fall") for (let i = 0; i < steps; i++) out.push(-i);
  else if (motion === "wave") {
    // Triangle: climb to the midpoint, then ease back to the tonic.
    const peak = Math.ceil((steps - 1) / 2);
    for (let i = 0; i < steps; i++) out.push(i <= peak ? i : 2 * peak - i);
  } else {
    // Random walk of ±1 (occasionally ±2) scale steps, bounded to a fifth.
    const rng = mulberry32(seed);
    let cur = 0;
    out.push(0);
    for (let i = 1; i < steps; i++) {
      const step = (rng() < 0.5 ? -1 : 1) * (rng() < 0.3 ? 2 : 1);
      cur = clamp(cur + step, -4, 4);
      out.push(cur);
    }
  }
  return out;
}

/** MIDI centre range Bloom spreads its layers across (E2–F#5). */
const BLOOM_RANGE: [number, number] = [40, 78];

export interface BloomOptions {
  root: number; // 0–11
  mode: ModeId;
  /** Register layers, each its own track. */
  layers: number;
  /** Harmonic steps, each its own scene. */
  steps: number;
  motion: MotionId;
  chord: ChordKind;
  /** Loop length of each scene's clips, in bars. */
  barsPerStep: number;
  vary: boolean;
  seed: number;
}

export interface BloomLayer {
  role: string;
  color: number;
  /** Notes for this layer at each step (index = scene). */
  clips: DriftNote[][];
}

export interface BloomResult {
  steps: number;
  barsPerStep: number;
  /** Chord-root note name per step, for scene naming. */
  stepLabels: string[];
  layers: BloomLayer[];
}

/**
 * Bloom lays out a grid of clips: register layers (rows/tracks) × harmonic
 * steps (columns/scenes). Each step is a diatonic chord placed a scale-degree
 * along the chosen motion; each layer voices that chord in its own register, so
 * launching scenes in turn walks the pad through an evolving progression.
 */
export function generateBloom(opts: BloomOptions): BloomResult {
  const nLayers = Math.max(1, opts.layers);
  const nSteps = Math.max(1, opts.steps);
  const offsets = motionOffsets(opts.motion, nSteps, opts.seed);
  const barBeats = opts.barsPerStep * BEATS_PER_BAR;
  const rng = mulberry32(opts.seed ^ 0x9e3779b9);

  const stepLabels = offsets.map((o) => NOTE_NAMES[scaleDegreePc(opts.root, opts.mode, o)]);

  const layers: BloomLayer[] = [];
  for (let i = 0; i < nLayers; i++) {
    const center = Math.round(nLayers === 1 ? 52 : lerp(BLOOM_RANGE[0], BLOOM_RANGE[1], i / (nLayers - 1)));
    const registerT = (center - BLOOM_RANGE[0]) / (BLOOM_RANGE[1] - BLOOM_RANGE[0]);
    const baseVel = Math.round(clamp(76 - registerT * 26, 46, 88));
    // Keep the bass open (root + one tone); fuller chords higher up.
    const voices = i === 0 ? 2 : 3;

    const clips: DriftNote[][] = offsets.map((offset) => {
      const chordPCs = chordPitchClasses(opts.root, opts.mode, offset, opts.chord);
      // The bass anchors the harmony: restrict it to the chord's root and an
      // upper tone so the drone always states the root, never a rootless slice.
      const layerChord =
        i === 0 ? [chordPCs[0], chordPCs[Math.min(2, chordPCs.length - 1)]] : chordPCs;
      const pitches = voiceChordInRegister(layerChord, center, voices);
      return pitches.map((pitch) => {
        const note: DriftNote = { pitch, startTime: 0, duration: barBeats, velocity: baseVel };
        if (opts.vary) {
          note.probability = clamp(0.9 - registerT * 0.25 - rng() * 0.1, 0.5, 1);
          note.velocityDeviation = 6;
        }
        return note;
      });
    });

    layers.push({ role: roleFor(center), color: LAYER_COLORS[i % LAYER_COLORS.length], clips });
  }

  return { steps: nSteps, barsPerStep: opts.barsPerStep, stepLabels, layers };
}

// --- Perform layout ----------------------------------------------------------

/** Push's Session grid shows this many track columns at once. */
export const PUSH_GRID_WIDTH = 8;

/**
 * Tracks a Perform rig will occupy: one per drift-bed layer, one for the Bloom
 * progression, one for the aleatoric shimmer, one to play. Kept within Push's
 * 8-column grid so the whole rig fits on the hardware at once.
 */
export function performTrackCount(
  bedOn: boolean,
  bedLayers: number,
  bloomOn: boolean,
  shimmerOn: boolean,
  playOn: boolean,
): number {
  return (
    (bedOn ? Math.max(1, bedLayers) : 0) +
    (bloomOn ? 1 : 0) +
    (shimmerOn ? 1 : 0) +
    (playOn ? 1 : 0)
  );
}

// --- Aleatoric generator -----------------------------------------------------

export type AleaLength = "short" | "medium" | "long";
export type AleaWeight = "chord" | "scale";

/** MIDI range each spread scatters notes across — pitched higher than the bed,
 *  since Aleatoric is a shimmer/melodic layer. */
const ALEA_SPREADS: Record<SpreadId, [number, number]> = {
  narrow: [60, 79], // C4–G5, bright
  wide: [55, 84], // G3–C6
  full: [48, 91], // C3–G6
};

/** Note-length range in beats, per character. */
const ALEA_LENGTHS: Record<AleaLength, [number, number]> = {
  short: [0.5, 1.5],
  medium: [1, 4],
  long: [3, 8],
};

export interface AleatoricOptions {
  root: number; // 0–11
  mode: ModeId;
  /** Clip length in bars. */
  bars: number;
  /** Average notes per bar. */
  density: number;
  spread: SpreadId;
  length: AleaLength;
  /** Weight note choice toward the tonic triad, or spread evenly across the scale. */
  weight: AleaWeight;
  vary: boolean;
  seed: number;
}

/**
 * Fill one long clip with notes scattered by probability: free (off-grid) start
 * times, humanized lengths and velocities, pitches drawn from the scale and
 * optionally weighted toward chord tones. With `vary` on, each note also gets a
 * play probability so the phrase re-shuffles on every loop. A self-contained
 * generative shimmer.
 */
export function generateAleatoric(opts: AleatoricOptions): DriftNote[] {
  const rng = mulberry32(opts.seed);
  const totalBeats = Math.max(BEATS_PER_BAR, opts.bars * BEATS_PER_BAR);
  const [lo, hi] = ALEA_SPREADS[opts.spread];
  const [lenMin, lenMax] = ALEA_LENGTHS[opts.length];
  const count = Math.max(1, Math.round(opts.density * opts.bars));

  // Candidate pitches in range, weighted toward tonic chord tones if asked.
  const scalePcs = scalePitchClasses(opts.root, opts.mode);
  const chordPcs = new Set(chordPitchClasses(opts.root, opts.mode, 0, "triad"));
  const candidates: { pitch: number; weight: number }[] = [];
  for (let p = lo; p <= hi; p++) {
    const pc = (((p % 12) + 12) % 12);
    if (!scalePcs.has(pc)) continue;
    const weight = opts.weight === "chord" ? (chordPcs.has(pc) ? 3 : 1) : 1;
    candidates.push({ pitch: p, weight });
  }
  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  const pickPitch = () => {
    let r = rng() * totalWeight;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) return c.pitch;
    }
    return candidates[candidates.length - 1].pitch;
  };

  const notes: DriftNote[] = [];
  for (let i = 0; i < count; i++) {
    const startTime = rng() * totalBeats;
    const chosenLen = lenMin + rng() * (lenMax - lenMin);
    // Keep notes inside the clip so nothing spills past the loop.
    const duration = Math.max(0.25, Math.min(chosenLen, totalBeats - startTime));
    const pitch = pickPitch();
    const velocity = Math.round(clamp(52 + rng() * 24, 40, 90));
    const note: DriftNote = { pitch, startTime, duration, velocity };
    if (opts.vary) {
      note.probability = clamp(0.5 + rng() * 0.4, 0.4, 1);
      note.velocityDeviation = 10;
    }
    notes.push(note);
  }
  notes.sort((a, b) => a.startTime - b.startTime);
  return notes;
}
