// Sanity checks for the chord maths. Run: pnpm test
import {
  buildClips,
  buildGrid,
  chordName,
  NOTE_NAMES,
  romanForDegree,
  variationPcs,
} from "./theory.js";

let failures = 0;
function expect(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${g}\n    want ${w}`}`);
}

const pc = (p: number) => NOTE_NAMES[((p % 12) + 12) % 12];
const pcs = (ps: number[]) => ps.map(pc);

// --- Diatonic triads in C major: I ii iii IV V vi vii° ---
expect(
  "C major triad names",
  [1, 2, 3, 4, 5, 6, 7].map((d) => chordName("major", 0, d, "triad")),
  ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
);
expect(
  "C major roman numerals",
  [1, 2, 3, 4, 5, 6, 7].map((d) => romanForDegree("major", d)),
  ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
);

// --- Diatonic triads in A minor: i ii° III iv v VI VII ---
expect(
  "A minor triad names",
  [1, 2, 3, 4, 5, 6, 7].map((d) => chordName("minor", 9, d, "triad")),
  ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
);

// --- Sevenths pick up diatonic quality ---
expect(
  "C major 7th names",
  [1, 2, 5, 7].map((d) => chordName("major", 0, d, "7")),
  ["Cmaj7", "Dm7", "G7", "Bm7♭5"],
);

// --- Variations name correctly (E minor degree in G major = vi) ---
expect("G major vi triad is Em", chordName("major", 7, 6, "triad"), "Em");
expect("G major vi 7th is Em7", chordName("major", 7, 6, "7"), "Em7");
expect("G major vi sus4 is Esus4", chordName("major", 7, 6, "sus4"), "Esus4");
expect("G major vi 6th is Em6", chordName("major", 7, 6, "6"), "Em6");
expect("G major vi add9 is Em(add9)", chordName("major", 7, 6, "add9"), "Em(add9)");

// --- Chord tones stay in the key (C major sus2 on I uses C D G) ---
expect("Csus2 pitch classes", pcs(variationPcs("major", 0, 1, "sus2")), ["C", "D", "G"]);
expect("Csus4 pitch classes", pcs(variationPcs("major", 0, 1, "sus4")), ["C", "F", "G"]);
expect("C6 pitch classes", pcs(variationPcs("major", 0, 1, "6")), ["C", "E", "G", "A"]);

// --- buildGrid exposes root-independent suffixes ---
const gMajor = buildGrid("major");
expect("grid has 7 degrees", gMajor.length, 7);
expect("grid ii suffix (triad) is m", gMajor[1].suffixes.triad, "m");
expect("grid V suffix (7th) is 7", gMajor[4].suffixes["7"], "7");
expect("grid vii° roman", gMajor[6].roman, "vii°");

// --- buildClips merges adjacent identical chords into longer clips ---
// B minor in D major: Bm Bm G D → 2-bar Bm, 1-bar G, 1-bar D.
const D = 2; // D
const Bm = 6; // vi in D major (degree 6)
const G = 4; // IV in D major (degree 4)
const seq = [
  { degree: 6, variationId: "triad" }, // Bm
  { degree: 6, variationId: "triad" }, // Bm
  { degree: 4, variationId: "triad" }, // G
  { degree: 1, variationId: "triad" }, // D
];
const clips = buildClips(seq, { mode: "major", root: 2, barBeats: 4, smart: false });
expect("merged clip names", clips.map((c) => c.name), ["Bm", "G", "D"]);
expect("merged clip durations (beats)", clips.map((c) => c.durationBeats), [8, 4, 4]);

// --- Non-adjacent duplicates are NOT merged ---
const seq2 = [
  { degree: 1, variationId: "triad" }, // D
  { degree: 4, variationId: "triad" }, // G
  { degree: 1, variationId: "triad" }, // D
];
const clips2 = buildClips(seq2, { mode: "major", root: 2, barBeats: 4, smart: false });
expect("non-adjacent duplicates stay separate", clips2.map((c) => c.name), ["D", "G", "D"]);

// --- Smart voicing keeps voices close between chords ---
const smart = buildClips(
  [
    { degree: 1, variationId: "triad" },
    { degree: 5, variationId: "triad" },
  ],
  { mode: "major", root: 0, barBeats: 4, smart: true },
);
const spread = Math.max(...smart[1].pitches) - Math.min(...smart[1].pitches);
expect("smart-voiced G stays within an octave", spread <= 12, true);
// keep tuple values referenced so the intent of the labels is clear
void [D, Bm, G];

console.log(failures === 0 ? "\nAll chords theory tests passed." : `\n${failures} test(s) failed.`);
if (failures > 0) process.exit(1);
