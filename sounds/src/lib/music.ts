export const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export type ModeId = "minor" | "major" | "dorian" | "mixolydian" | "lydian" | "phrygian";

export interface Mode {
  id: ModeId;
  label: string;
  steps: number[];
  /** Semitones from the relative major's tonic up to this mode's tonic. */
  rel: number;
}

export const MODES: Mode[] = [
  { id: "minor", label: "Minor (Aeolian)", steps: [0, 2, 3, 5, 7, 8, 10], rel: 9 },
  { id: "major", label: "Major (Ionian)", steps: [0, 2, 4, 5, 7, 9, 11], rel: 0 },
  { id: "dorian", label: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10], rel: 2 },
  { id: "mixolydian", label: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10], rel: 7 },
  { id: "lydian", label: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11], rel: 5 },
  { id: "phrygian", label: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10], rel: 4 },
];

export interface Settings {
  root: number;
  mode: ModeId;
  bpm: number;
}

export const DEFAULT_SETTINGS: Settings = { root: 2, mode: "minor", bpm: 70 };

export function modeOf(id: ModeId): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0]!;
}

/** Keys whose relative major is F, B♭, E♭, A♭, D♭ or G♭ are spelled with flats. */
export function noteNames(s: Settings): string[] {
  const relMajor = (((s.root - modeOf(s.mode).rel) % 12) + 12) % 12;
  return [5, 10, 3, 8, 1, 6].includes(relMajor) ? FLAT : SHARP;
}

export function keyName(s: Settings): string {
  return `${noteNames(s)[s.root]} ${s.mode}`;
}

export interface Chord {
  note: string;
  name: string;
  roman: string;
  tonic: boolean;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** The seven diatonic triads of the key, stacked in thirds. */
export function diatonicChords(s: Settings): Chord[] {
  const steps = modeOf(s.mode).steps;
  const names = noteNames(s);
  return steps.map((a, i) => {
    const b = steps[(i + 2) % 7]! + (i + 2 >= 7 ? 12 : 0);
    const c = steps[(i + 4) % 7]! + (i + 4 >= 7 ? 12 : 0);
    const third = b - a;
    const fifth = c - a;
    const quality =
      third === 4 && fifth === 7 ? "maj" : third === 3 && fifth === 7 ? "min" : third === 3 && fifth === 6 ? "dim" : "aug";
    const note = names[(s.root + a) % 12]!;
    const numeral = quality === "maj" || quality === "aug" ? ROMAN[i]! : ROMAN[i]!.toLowerCase();
    return {
      note,
      name: note + ({ maj: "", min: "m", dim: "dim", aug: "aug" } as const)[quality],
      roman: numeral + (quality === "dim" ? "°" : quality === "aug" ? "+" : ""),
      tonic: i === 0,
    };
  });
}

export function scaleNotes(s: Settings): string[] {
  const names = noteNames(s);
  return modeOf(s.mode).steps.map((step) => names[(s.root + step) % 12]!);
}

function freq(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}
function hz(f: number) {
  return `${f.toFixed(f < 100 ? 2 : 1)} Hz`;
}
function ms(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}

/** Every key- and tempo-dependent value the lessons show. */
export function derived(s: Settings) {
  const names = noteNames(s);
  const q = 60000 / s.bpm;
  const kick = 24 + s.root; // octave 1, where C1 is MIDI 24
  const loop = (14 * 240) / s.bpm; // 14 bars of 4/4, in seconds
  const transpose = s.root > 6 ? 12 - s.root : -s.root; // Simpler plays recorded pitch on C3
  const ascii = names[s.root]!.replace("♯", "#").replace("♭", "b");
  const genKey = `${ascii} ${s.mode === "major" ? "major" : "minor"}`;
  return {
    keyName: keyName(s),
    kickRoot: hz(freq(kick)),
    kickFifth: hz(freq(kick + 7)),
    kickNote: `${names[s.root]}1`,
    bassRoot: `${names[s.root]}1 · ${hz(freq(kick))}`,
    transpose: `${transpose > 0 ? "+" : ""}${transpose} st`,
    quarter: ms(q),
    dotted: ms(q * 0.75),
    eighth: ms(q / 2),
    bar: ms(q * 4),
    pre: ms(q / 16),
    bpm: `${s.bpm} BPM`,
    doubleBpm: `${s.bpm * 2} BPM`,
    loopSecs: `${Math.abs(loop - Math.round(loop)) < 0.01 ? loop.toFixed(0) : loop.toFixed(2)} s`,
    cmdPads: `gen_textures.py textures/pads.txt --key "${genKey}" --duration 30 --cfg 4`,
    cmdLoops: `gen_textures.py textures/loops.txt --key "${genKey}" --bpm ${s.bpm} --duration ${Math.round(loop)} --cfg 4`,
  };
}

export type Derived = ReturnType<typeof derived>;
