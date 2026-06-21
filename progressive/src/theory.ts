/**
 * Music theory for Progressive.
 *
 * Pure functions only — no SDK imports — so the chord maths can be unit-tested
 * outside Live and shared verbatim with the dialog UI (the catalog is injected
 * into the HTML so the buttons the user sees match what gets generated).
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
 * A curated progression, expressed as scale degrees (1-based) so it adapts to
 * whatever key the user picks. Diatonic chord quality falls out of the scale,
 * so the same degree list gives the right chords in any key.
 */
export interface Progression {
  id: string;
  /** Human label shown on the dialog and used to name the scene group. */
  label: string;
  /** Scale degrees, 1-based (1 = tonic). Repeats allowed (e.g. blues). */
  degrees: number[];
}

export const PROGRESSIONS: Record<Mode, Progression[]> = {
  major: [
    { id: "axis", label: "Pop axis · I–V–vi–IV", degrees: [1, 5, 6, 4] },
    { id: "doowop", label: "50s doo-wop · I–vi–IV–V", degrees: [1, 6, 4, 5] },
    { id: "pop-vi", label: "Pop · vi–IV–I–V", degrees: [6, 4, 1, 5] },
    { id: "three-chord", label: "Three-chord · I–IV–V", degrees: [1, 4, 5] },
    { id: "ii-v-i", label: "Jazz · ii–V–I", degrees: [2, 5, 1] },
    {
      id: "pachelbel",
      label: "Pachelbel · I–V–vi–iii–IV–I–IV–V",
      degrees: [1, 5, 6, 3, 4, 1, 4, 5],
    },
    {
      id: "blues",
      label: "12-bar blues",
      degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
    },
  ],
  minor: [
    { id: "pop-minor", label: "Pop minor · i–VI–III–VII", degrees: [1, 6, 3, 7] },
    { id: "andalusian", label: "Andalusian · i–VII–VI–v", degrees: [1, 7, 6, 5] },
    { id: "minor-iv-v", label: "Minor · i–iv–v", degrees: [1, 4, 5] },
    { id: "i-vi-vii", label: "Lament · i–VI–VII", degrees: [1, 6, 7] },
    { id: "i-iv-vii-iii", label: "Epic · i–iv–VII–III", degrees: [1, 4, 7, 3] },
    {
      id: "blues-minor",
      label: "12-bar blues (minor)",
      degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
    },
  ],
};

/** Pitch classes (0–11) of a diatonic chord stacked in thirds on `degree`. */
function chordPitchClasses(mode: Mode, root: number, degree: number, notes: number): number[] {
  const scale = SCALE_INTERVALS[mode];
  const d0 = degree - 1; // to 0-based
  const pcs: number[] = [];
  for (let i = 0; i < notes; i++) {
    const idx = d0 + i * 2;
    const octave = Math.floor(idx / scale.length);
    pcs.push((root + scale[idx % scale.length] + octave * 12) % 12);
  }
  return pcs;
}

/** Chord quality from the actual third/fifth/seventh intervals above the root. */
function quality(pcs: number[]): { suffix: string; isMinorish: boolean; isDim: boolean; isAug: boolean } {
  const iv = (n: number) => ((pcs[n] - pcs[0]) % 12 + 12) % 12;
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

/** e.g. "Am", "G7", "Bdim". */
export function chordName(mode: Mode, root: number, degree: number, notes: number): string {
  const pcs = chordPitchClasses(mode, root, degree, notes);
  return NOTE_NAMES[pcs[0]] + quality(pcs).suffix;
}

/** Roman numeral with case + symbol reflecting quality, e.g. "ii", "V7", "vii°". */
export function romanLabel(mode: Mode, root: number, degree: number, notes: number): string {
  const pcs = chordPitchClasses(mode, root, degree, notes);
  const q = quality(pcs);
  let r: string = ROMAN[(degree - 1) % 7];
  if (q.isMinorish || q.isDim) r = r.toLowerCase();
  if (q.isDim) r += "°";
  if (q.isAug) r += "+";
  if (notes > 3) r += "7";
  return r;
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
    let root = center - (((center - rootPc) % 12 + 12) % 12);
    if (center - root > 6) root += 12;
    const out = [root];
    for (let i = 1; i < pcs.length; i++) {
      let p = root + (((pcs[i] - rootPc) % 12) + 12) % 12;
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

export interface ChordSpec {
  /** Index of the chord within its progression (0-based). */
  step: number;
  chordName: string;
  roman: string;
  pitches: number[];
}

export interface GeneratedProgression {
  id: string;
  label: string;
  chords: ChordSpec[];
}

export interface GenerateOptions {
  root: number; // 0–11
  mode: Mode;
  progressionIds: string[];
  seventh: boolean;
  smart: boolean;
  /** MIDI pitch the first chord's root is voiced near. */
  center?: number;
}

/** Turn a set of selected progressions into fully voiced chord sequences. */
export function generate(opts: GenerateOptions): GeneratedProgression[] {
  const notes = opts.seventh ? 4 : 3;
  const center = opts.center ?? 60;
  const catalog = PROGRESSIONS[opts.mode];

  return opts.progressionIds
    .map((id) => catalog.find((p) => p.id === id))
    .filter((p): p is Progression => Boolean(p))
    .map((prog) => {
      let previous: number[] | null = null;
      const chords = prog.degrees.map((degree, step) => {
        const pcs = chordPitchClasses(opts.mode, opts.root, degree, notes);
        const pitches = voiceChord(pcs, center, previous, opts.smart);
        previous = pitches;
        return {
          step,
          chordName: chordName(opts.mode, opts.root, degree, notes),
          roman: romanLabel(opts.mode, opts.root, degree, notes),
          pitches,
        };
      });
      return { id: prog.id, label: prog.label, chords };
    });
}
