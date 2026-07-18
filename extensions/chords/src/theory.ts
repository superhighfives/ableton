/**
 * Music theory for Chords.
 *
 * Pure functions only — no SDK imports — so the chord maths can be unit-tested
 * outside Live and shared with the dialog UI. The dialog renders a grid of
 * diatonic chords (columns = scale degrees I–VII, rows = variations), and the
 * extension turns a clicked sequence of grid cells into voiced MIDI clips.
 *
 * Pitch convention: MIDI note numbers, where 60 = C3 (Ableton's middle C).
 */

export type Mode = "major" | "minor";

/** Semitone offsets of each scale degree from the root. */
const SCALE_INTERVALS: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  // Natural minor (Aeolian).
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Note names indexed by pitch class (0 = C). Sharps; good enough for v1. */
export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;

/**
 * A chord variation (a grid row), expressed as scale-step offsets from the
 * chord's own degree. Stacking in thirds is [0, 2, 4]; sus/6/add9 pull other
 * scale tones so every variation stays diatonic — "chords that fit the key".
 */
export interface Variation {
  id: string;
  /** Row label shown down the side of the grid. */
  label: string;
  /** Scale-step offsets from the degree (0 = the chord root). */
  steps: number[];
}

export const VARIATIONS: Variation[] = [
  { id: "triad", label: "Triad", steps: [0, 2, 4] },
  { id: "7", label: "7th", steps: [0, 2, 4, 6] },
  { id: "sus2", label: "sus2", steps: [0, 1, 4] },
  { id: "sus4", label: "sus4", steps: [0, 3, 4] },
  { id: "6", label: "6th", steps: [0, 2, 4, 5] },
  { id: "add9", label: "add9", steps: [0, 2, 4, 7] },
];

function findVariation(id: string): Variation {
  const v = VARIATIONS.find((x) => x.id === id);
  if (!v) throw new Error(`unknown chord variation "${id}"`);
  return v;
}

/** Pitch class (0–11) of a scale tone `step` steps above `degree` in the key. */
function scaleStepPc(mode: Mode, root: number, degree: number, step: number): number {
  const scale = SCALE_INTERVALS[mode];
  const idx = degree - 1 + step; // 0-based scale index, may exceed the octave
  const octave = Math.floor(idx / scale.length);
  const within = ((idx % scale.length) + scale.length) % scale.length;
  return (((root + scale[within] + octave * 12) % 12) + 12) % 12;
}

/** Pitch classes (0–11) of one grid cell — a variation on a diatonic degree. */
export function variationPcs(
  mode: Mode,
  root: number,
  degree: number,
  variationId: string,
): number[] {
  return findVariation(variationId).steps.map((s) => scaleStepPc(mode, root, degree, s));
}

/** Chord quality from the actual third/fifth/seventh intervals above the root. */
function quality(pcs: number[]): { suffix: string; isMinorish: boolean; isDim: boolean; isAug: boolean } {
  const iv = (n: number) => (((pcs[n] - pcs[0]) % 12) + 12) % 12;
  const third = iv(1);
  const fifth = iv(2);
  const seventh = pcs.length > 3 ? iv(3) : null;

  const isDim = third === 3 && fifth === 6;
  const isAug = third === 4 && fifth === 8;
  const isMinorish = third === 3;

  let suffix = "";
  if (isDim) suffix = seventh === 9 ? "dim7" : seventh === 10 ? "m7♭5" : "dim";
  else if (isAug) suffix = "aug";
  else if (third === 3) suffix = seventh === 10 ? "m7" : "m";
  else if (third === 4) suffix = seventh === 11 ? "maj7" : seventh === 10 ? "7" : "";

  return { suffix, isMinorish, isDim, isAug };
}

/** Triad quality at a degree, evaluated relative to C — key-independent. */
function triadQuality(mode: Mode, degree: number) {
  return quality([0, 2, 4].map((s) => scaleStepPc(mode, 0, degree, s)));
}

/**
 * The chord-name suffix for a grid cell (everything after the root letter, e.g.
 * "m", "maj7", "sus4"). Depends only on mode + degree + variation, never the
 * key's root — so the dialog can build names by prefixing the root note letter.
 */
export function chordSuffix(mode: Mode, degree: number, variationId: string): string {
  const tri = triadQuality(mode, degree);
  switch (variationId) {
    case "triad":
      return tri.suffix;
    case "7":
      return quality([0, 2, 4, 6].map((s) => scaleStepPc(mode, 0, degree, s))).suffix;
    case "sus2":
      return "sus2";
    case "sus4":
      return "sus4";
    case "6":
      return tri.isMinorish ? "m6" : "6";
    case "add9":
      return tri.isMinorish ? "m(add9)" : "add9";
    default:
      throw new Error(`unknown chord variation "${variationId}"`);
  }
}

/** Full chord name for a grid cell, e.g. "Em7", "Gsus4", "Bdim". */
export function chordName(mode: Mode, root: number, degree: number, variationId: string): string {
  const rootPc = scaleStepPc(mode, root, degree, 0);
  return NOTE_NAMES[rootPc] + chordSuffix(mode, degree, variationId);
}

/** Roman numeral for a degree's triad, cased + marked by quality (e.g. "ii", "V", "vii°"). */
export function romanForDegree(mode: Mode, degree: number): string {
  const q = triadQuality(mode, degree);
  let r: string = ROMAN[(degree - 1) % 7];
  if (q.isMinorish || q.isDim) r = r.toLowerCase();
  if (q.isDim) r += "°";
  if (q.isAug) r += "+";
  return r;
}

/** One column of the grid: a diatonic degree, root-independent so it injects cheaply. */
export interface GridDegree {
  degree: number; // 1–7
  roman: string;
  /** Semitone offset of the chord root from the key root. */
  rootOffset: number;
  /** variationId → name suffix, so the dialog builds names by adding the root. */
  suffixes: Record<string, string>;
}

/** The whole grid for a mode: 7 degrees, each with its variation suffixes. */
export function buildGrid(mode: Mode): GridDegree[] {
  return [1, 2, 3, 4, 5, 6, 7].map((degree) => ({
    degree,
    roman: romanForDegree(mode, degree),
    rootOffset: SCALE_INTERVALS[mode][degree - 1],
    suffixes: Object.fromEntries(VARIATIONS.map((v) => [v.id, chordSuffix(mode, degree, v.id)])),
  }));
}

/**
 * Pick actual MIDI pitches for a chord.
 *
 * Without `previous`, the chord is voiced in root position with its root placed
 * near `center`. With `previous` and smart voicing on, we choose octave
 * placements for each chord tone that minimise total movement from the previous
 * voicing — simple greedy voice-leading that keeps common tones put and moves
 * the rest by the smallest step.
 */
export function voiceChord(
  pcs: number[],
  center: number,
  previous: number[] | null,
  smart: boolean,
): number[] {
  if (!previous || !smart) {
    // Root position: place the root nearest `center`, stack the rest above it.
    const rootPc = pcs[0];
    let root = center - ((((center - rootPc) % 12) + 12) % 12);
    if (center - root > 6) root += 12;
    const out = [root];
    for (let i = 1; i < pcs.length; i++) {
      let p = root + ((((pcs[i] - rootPc) % 12) + 12) % 12);
      while (p <= out[out.length - 1]) p += 12;
      out.push(p);
    }
    return out;
  }

  // Smart: for each pitch class, choose the octave landing closest to the
  // nearest note of the previous voicing. Keep voices in a sane register.
  const lo = center - 9;
  const hi = center + 12;
  const placed = pcs.map((pc) => {
    let best = pc;
    let bestCost = Infinity;
    for (let oct = 2; oct <= 7; oct++) {
      const cand = pc + oct * 12;
      if (cand < lo - 6 || cand > hi + 6) continue;
      const nearest = Math.min(...previous.map((p) => Math.abs(cand - p)));
      const registerPenalty = cand < lo || cand > hi ? 6 : 0;
      const cost = nearest + registerPenalty;
      if (cost < bestCost) {
        bestCost = cost;
        best = cand;
      }
    }
    return best;
  });
  return placed.sort((a, b) => a - b);
}

/** One clicked grid cell in a progression's sequence. */
export interface SeqCell {
  degree: number;
  variationId: string;
}

/** A merged, voiced chord ready to write as a Session clip. */
export interface ChordClip {
  name: string;
  pitches: number[];
  durationBeats: number;
}

export interface BuildClipsOptions {
  mode: Mode;
  root: number; // 0–11
  /** Length of one sequence step, in beats (one bar of 4/4 = 4). */
  barBeats: number;
  smart: boolean;
  /** MIDI pitch the first chord's root is voiced near. */
  center?: number;
}

/**
 * Turn a clicked sequence of grid cells into voiced clips.
 *
 * Adjacent identical cells merge into a single longer clip — clicking Bm twice
 * then G then D yields a 2-bar Bm, a 1-bar G and a 1-bar D. Smart voicing
 * threads the voice-leading across the merged runs.
 */
export function buildClips(cells: SeqCell[], opts: BuildClipsOptions): ChordClip[] {
  const center = opts.center ?? 60;

  // Collapse runs of the same chord (same degree + variation) into one clip.
  const runs: { cell: SeqCell; count: number }[] = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last && last.cell.degree === cell.degree && last.cell.variationId === cell.variationId) {
      last.count++;
    } else {
      runs.push({ cell, count: 1 });
    }
  }

  let previous: number[] | null = null;
  return runs.map((run) => {
    const pcs = variationPcs(opts.mode, opts.root, run.cell.degree, run.cell.variationId);
    const pitches = voiceChord(pcs, center, previous, opts.smart);
    previous = pitches;
    return {
      name: chordName(opts.mode, opts.root, run.cell.degree, run.cell.variationId),
      pitches,
      durationBeats: run.count * opts.barBeats,
    };
  });
}
