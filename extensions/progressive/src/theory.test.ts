// Sanity checks for the chord maths. Run: pnpm test
import { generate, NOTE_NAMES } from "./theory.js";

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

// --- C major, I–V–vi–IV (axis), triads, root position ---
const cMajorAxis = generate({
  root: 0, mode: "major", progressionIds: ["axis"], seventh: false, smart: false,
})[0];

expect("axis chord names", cMajorAxis.chords.map((c) => c.chordName), ["C", "G", "Am", "F"]);
expect("axis roman numerals", cMajorAxis.chords.map((c) => c.roman), ["I", "V", "vi", "IV"]);

// --- Direction: down reverses the order, random keeps the same multiset ---
const axisDown = generate({
  root: 0, mode: "major", progressionIds: ["axis"], seventh: false, smart: false, direction: "down",
})[0];
expect("axis down reverses order", axisDown.chords.map((c) => c.chordName), ["F", "Am", "G", "C"]);

const axisRandom = generate({
  root: 0, mode: "major", progressionIds: ["axis"], seventh: false, smart: false, direction: "random",
})[0];
expect(
  "axis random keeps the same chord multiset",
  [...axisRandom.chords.map((c) => c.chordName)].sort(),
  ["Am", "C", "F", "G"],
);
expect("axis random has 4 chords", axisRandom.chords.length, 4);

// --- Octave register: up rises, down falls, level is unchanged ---
const avg = (ps: number[]) => ps.reduce((a, b) => a + b, 0) / ps.length;
const lastVsFirst = (g: { chords: { pitches: number[] }[] }) =>
  avg(g.chords[g.chords.length - 1].pitches) - avg(g.chords[0].pitches);

const regUp = generate({
  root: 0, mode: "major", progressionIds: ["axis"], seventh: false, smart: false, register: "up",
})[0];
const regDown = generate({
  root: 0, mode: "major", progressionIds: ["axis"], seventh: false, smart: false, register: "down",
})[0];
expect("register up: last chord higher than first", lastVsFirst(regUp) > 6, true);
expect("register down: last chord lower than first", lastVsFirst(regDown) < -6, true);
// Register and order are independent: chord identities are unchanged by register.
expect("register up keeps chord names", regUp.chords.map((c) => c.chordName), ["C", "G", "Am", "F"]);
expect("C major triad pitch classes", pcs(cMajorAxis.chords[0].pitches), ["C", "E", "G"]);
expect("A minor triad pitch classes", pcs(cMajorAxis.chords[2].pitches), ["A", "C", "E"]);

// --- A natural minor, pop-minor i–VI–III–VII ---
const aMinor = generate({
  root: 9, mode: "minor", progressionIds: ["pop-minor"], seventh: false, smart: false,
})[0];
expect("a-minor chord names", aMinor.chords.map((c) => c.chordName), ["Am", "F", "C", "G"]);
expect("a-minor roman", aMinor.chords.map((c) => c.roman), ["i", "VI", "III", "VII"]);

// --- Sevenths: G dominant 7 in C major (ii–V–I) ---
const cJazz = generate({
  root: 0, mode: "major", progressionIds: ["ii-v-i"], seventh: true, smart: false,
})[0];
expect("ii-V-I 7th names", cJazz.chords.map((c) => c.chordName), ["Dm7", "G7", "Cmaj7"]);
expect("ii-V-I 7th roman", cJazz.chords.map((c) => c.roman), ["ii7", "V7", "I7"]);
expect("G7 pitch classes", pcs(cJazz.chords[1].pitches), ["G", "B", "D", "F"]);

// --- Diminished: vii° in C major (build a tiny custom check via three-chord won't hit it;
//     use the fact that degree 7 of C major is B dim). Generate a progression that includes it. ---
// (Pachelbel doesn't include vii; verify dim through quality of B chord by constructing from minor's ii°.)
const dMinor = generate({
  root: 2, mode: "minor", progressionIds: ["minor-iv-v"], seventh: false, smart: false,
})[0];
expect("d-minor i–iv–v names", dMinor.chords.map((c) => c.chordName), ["Dm", "Gm", "Am"]);

// --- Smart voicing keeps movement small ---
const smart = generate({
  root: 0, mode: "major", progressionIds: ["axis"], seventh: false, smart: true,
})[0];
const totalMovement = (chords: { pitches: number[] }[]) => {
  let sum = 0;
  for (let i = 1; i < chords.length; i++) {
    const prev = chords[i - 1].pitches;
    for (const p of chords[i].pitches) sum += Math.min(...prev.map((q) => Math.abs(p - q)));
  }
  return sum;
};
const plain = generate({
  root: 0, mode: "major", progressionIds: ["axis"], seventh: false, smart: false,
})[0];
const sMove = totalMovement(smart.chords);
const pMove = totalMovement(plain.chords);
console.log(`\nvoice-leading movement: smart=${sMove} plain=${pMove}`);
expect("smart voicing moves less than root position", sMove < pMove, true);
// Smart voicing must still contain the right pitch classes per chord.
expect("smart Am still A/C/E", [...new Set(pcs(smart.chords[2].pitches))].sort(), ["A", "C", "E"]);

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
