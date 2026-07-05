// Sanity checks for the ambient generative maths. Run: pnpm test
import {
  BEATS_PER_BAR,
  buildVoicing,
  chordPitchClasses,
  coprimeLengths,
  gcd,
  generateBloom,
  generateDrift,
  euclid,
  generateAleatoric,
  generateBass,
  generateRhythm,
  motionOffsets,
  mulberry32,
  performTrackCount,
  PUSH_GRID_WIDTH,
  scaleDegreePc,
  scalePitchClasses,
  snapToScale,
  voiceChordInRegister,
  type AleatoricOptions,
  type BassOptions,
  type BloomOptions,
  type DriftOptions,
  type RhythmOptions,
} from "./theory.js";

let failures = 0;
function expect(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${g}\n    want ${w}`}`);
}
function assert(label: string, cond: boolean) {
  expect(label, cond, true);
}

// --- Coprime phasing lengths ---
expect("coprimeLengths(4) → first four primes", coprimeLengths(4), [3, 5, 7, 11]);
expect("coprimeLengths clamps to 1 minimum", coprimeLengths(0), [3]);
const lens = coprimeLengths(6);
let pairwiseCoprime = true;
for (let i = 0; i < lens.length; i++)
  for (let j = i + 1; j < lens.length; j++)
    if (gcd(lens[i], lens[j]) !== 1) pairwiseCoprime = false;
assert("all layer lengths are pairwise coprime", pairwiseCoprime);

// --- Scale membership & snapping ---
// C Lydian = C D E F# G A B → pitch classes {0,2,4,6,7,9,11}
expect("C Lydian pitch classes", [...scalePitchClasses(0, "lydian")].sort((a, b) => a - b), [0, 2, 4, 6, 7, 9, 11]);
// F (5) is not in C Lydian; nearest scale tone is E(4) or F#(6) — snap picks the closer, ties resolve upward here.
assert("snapToScale keeps result in scale", scalePitchClasses(0, "lydian").has(((snapToScale(65, 0, "lydian") % 12) + 12) % 12));
expect("snapToScale leaves in-scale pitches untouched", snapToScale(67, 0, "lydian"), 67);

// --- Voicings ---
// Stacked fifths from C3 (60): 60, 67, 74, 81 (all snapped, but perfect fifths land in most scales).
const fifths = buildVoicing(60, 3, "fifths", 0, "ionian");
assert("fifths voicing is ascending & unique", fifths.every((p, i) => i === 0 || p > fifths[i - 1]));
assert("fifths voicing has requested voice count", fifths.length === 3);
assert("every voicing note is in scale", buildVoicing(60, 4, "quartal", 2, "dorian").every((p) => scalePitchClasses(2, "dorian").has(((p % 12) + 12) % 12)));

// --- Deterministic RNG ---
const rngA = mulberry32(42);
const rngB = mulberry32(42);
expect("same seed → same sequence", [rngA(), rngA(), rngA()], [rngB(), rngB(), rngB()]);

// --- Drift generation ---
const baseOpts: DriftOptions = {
  root: 2, mode: "dorian", layers: 4, voices: 3, voicing: "quartal", spread: "wide", vary: true, seed: 7,
};
const drift = generateDrift(baseOpts);
expect("drift produces one layer per requested layer", drift.length, 4);
expect("layer loop lengths are the coprime set", drift.map((l) => l.bars), [3, 5, 7, 11]);
assert("each note sustains its full loop length", drift.every((l) => l.notes.every((nd) => nd.duration === l.bars * BEATS_PER_BAR)));
assert("every drift note is in the chosen scale", drift.every((l) => l.notes.every((nd) => scalePitchClasses(2, "dorian").has(((nd.pitch % 12) + 12) % 12))));
assert("vary=true attaches per-note probability", drift.every((l) => l.notes.every((nd) => typeof nd.probability === "number")));
assert("layers ascend in register (lowest note rises per layer)", drift.every((l, i) => i === 0 || Math.min(...l.notes.map((n) => n.pitch)) >= Math.min(...drift[i - 1].notes.map((n) => n.pitch))));

// vary=false → deterministic pad, no probability
const fixed = generateDrift({ ...baseOpts, vary: false });
assert("vary=false leaves probability unset", fixed.every((l) => l.notes.every((nd) => nd.probability === undefined)));

// Determinism: same seed reproduces the patch exactly.
expect("same seed reproduces the same drift", generateDrift(baseOpts), generateDrift(baseOpts));

// --- Bloom: chords, motion, voicing, grid ---
// C major triad on the tonic (degree 0) = C E G = {0,4,7}.
expect("triad on tonic of C major", chordPitchClasses(0, "ionian", 0, "triad").sort((a, b) => a - b), [0, 4, 7]);
// Quartal on the tonic of C major stacks scale fourths: C F B = {0,5,11}.
expect("quartal on tonic of C major", chordPitchClasses(0, "ionian", 0, "quartal").sort((a, b) => a - b), [0, 5, 11]);
assert("add9 adds a fourth distinct tone", chordPitchClasses(0, "ionian", 0, "add9").length === 4);

// Motion shapes.
expect("rise motion climbs by scale steps", motionOffsets("rise", 4, 0), [0, 1, 2, 3]);
expect("fall motion descends", motionOffsets("fall", 4, 0), [0, -1, -2, -3]);
expect("wave motion is a triangle back to tonic", motionOffsets("wave", 5, 0), [0, 1, 2, 1, 0]);
expect("random motion starts on the tonic", motionOffsets("random", 6, 99)[0], 0);
expect("random motion is seed-deterministic", motionOffsets("random", 6, 99), motionOffsets("random", 6, 99));
assert("random motion stays within a fifth", motionOffsets("random", 32, 5).every((o) => o >= -4 && o <= 4));

// Register voicing picks notes near the centre, in the chord.
const voiced = voiceChordInRegister([0, 4, 7], 60, 3);
assert("register voicing returns requested voice count", voiced.length === 3);
assert("register voicing is ascending", voiced.every((p, i) => i === 0 || p > voiced[i - 1]));
assert("register voicing stays in the chord", voiced.every((p) => [0, 4, 7].includes(((p % 12) + 12) % 12)));

const bloomOpts: BloomOptions = {
  root: 7, mode: "lydian", layers: 3, steps: 5, motion: "wave", chord: "add9", barsPerStep: 4, vary: true, seed: 3,
};
const bloom = generateBloom(bloomOpts);
expect("bloom has one row per layer", bloom.layers.length, 3);
assert("every layer has one clip per step", bloom.layers.every((l) => l.clips.length === 5));
expect("step labels track the motion roots", bloom.stepLabels.length, 5);
// G Lydian pitch classes; every generated note must be diatonic.
const gLydianPcs = scalePitchClasses(7, "lydian");
assert("every bloom note is in the chosen scale", bloom.layers.every((l) => l.clips.every((c) => c.every((nd) => gLydianPcs.has(((nd.pitch % 12) + 12) % 12)))));
assert("each bloom clip sustains its step length", bloom.layers.every((l) => l.clips.every((c) => c.every((nd) => nd.duration === bloomOpts.barsPerStep * BEATS_PER_BAR))));
assert("bloom layers ascend in register", bloom.layers.every((l, i) => {
  if (i === 0) return true;
  const lowThis = Math.min(...l.clips.flat().map((n) => n.pitch));
  const lowPrev = Math.min(...bloom.layers[i - 1].clips.flat().map((n) => n.pitch));
  return lowThis >= lowPrev;
}));
assert("bloom bass layer stays open (2 voices)", bloom.layers[0].clips.every((c) => c.length <= 2));
// The drone must anchor each step's chord root.
const bloomOffsets = motionOffsets(bloomOpts.motion, bloomOpts.steps, bloomOpts.seed);
assert("bloom drone always states the chord root", bloom.layers[0].clips.every((c, s) => {
  const rootPc = scaleDegreePc(bloomOpts.root, bloomOpts.mode, bloomOffsets[s]);
  return c.some((n) => (((n.pitch % 12) + 12) % 12) === rootPc);
}));
expect("same seed reproduces the same bloom", generateBloom(bloomOpts), generateBloom(bloomOpts));
// First step is the tonic; its root note name should be the key's root.
expect("first step is the tonic", bloom.stepLabels[0], "G");
// Rise motion in C major labels the ascending diatonic roots.
expect("rise labels ascend the C major scale", generateBloom({ ...bloomOpts, root: 0, mode: "ionian", motion: "rise", steps: 5 }).stepLabels, ["C", "D", "E", "F", "G"]);

// --- Aleatoric: scatter, ranges, weighting ---
const aleaOpts: AleatoricOptions = {
  root: 5, mode: "lydian", bars: 16, density: 3, spread: "wide", length: "medium", weight: "chord", vary: true, seed: 11,
};
const alea = generateAleatoric(aleaOpts);
const aleaTotal = aleaOpts.bars * BEATS_PER_BAR;
expect("aleatoric note count ~ density × bars", alea.length, 48);
const fLydian = scalePitchClasses(5, "lydian");
assert("every aleatoric note is in the scale", alea.every((n) => fLydian.has(((n.pitch % 12) + 12) % 12)));
assert("aleatoric notes sit in the wide register (G3–C6)", alea.every((n) => n.pitch >= 55 && n.pitch <= 84));
assert("aleatoric notes start within the clip", alea.every((n) => n.startTime >= 0 && n.startTime < aleaTotal));
assert("aleatoric notes never spill past the loop", alea.every((n) => n.startTime + n.duration <= aleaTotal + 1e-9));
assert("aleatoric durations respect the floor", alea.every((n) => n.duration >= 0.25 - 1e-9));
// Stress the clip end: a short, dense clip puts many notes near the boundary.
let spillOk = true;
for (let s = 0; s < 200; s++) {
  const total = 2 * BEATS_PER_BAR; // 2-bar clip
  const dense = generateAleatoric({ root: 0, mode: "ionian", bars: 2, density: 6, spread: "narrow", length: "long", weight: "scale", vary: false, seed: s });
  if (!dense.every((n) => n.startTime + n.duration <= total + 1e-9 && n.duration >= 0.25 - 1e-9)) spillOk = false;
}
assert("aleatoric never spills near the clip end (200 seeds, dense)", spillOk);
assert("aleatoric notes are sorted by start time", alea.every((n, i) => i === 0 || n.startTime >= alea[i - 1].startTime));
assert("vary=true attaches per-note probability", alea.every((n) => typeof n.probability === "number"));
assert("vary=false leaves probability unset", generateAleatoric({ ...aleaOpts, vary: false }).every((n) => n.probability === undefined));
expect("same seed reproduces the same scatter", generateAleatoric(aleaOpts), generateAleatoric(aleaOpts));
// Chord weighting lands on tonic-triad tones at least as often as flat weighting (same rng stream).
const chordPcsF = new Set(chordPitchClasses(5, "lydian", 0, "triad"));
const isChord = (n: { pitch: number }) => chordPcsF.has(((n.pitch % 12) + 12) % 12);
const chordShareWeighted = generateAleatoric({ ...aleaOpts, weight: "chord" }).filter(isChord).length;
const chordShareFlat = generateAleatoric({ ...aleaOpts, weight: "scale" }).filter(isChord).length;
assert("chord weighting favours chord tones", chordShareWeighted >= chordShareFlat);

// --- Euclidean rhythm ---
expect("euclid(4,16) is downbeat quarters", euclid(4, 16).map((h, i) => (h ? i : -1)).filter((i) => i >= 0), [0, 4, 8, 12]);
expect("euclid(3,8) is the classic tresillo spread", euclid(3, 8).map((h, i) => (h ? i : -1)).filter((i) => i >= 0), [0, 3, 6]);
assert("euclid places exactly `pulses` hits", euclid(5, 16).filter(Boolean).length === 5);
assert("euclid(0,16) is silent", euclid(0, 16).every((h) => !h));
assert("euclid clamps pulses to steps", euclid(20, 8).filter(Boolean).length === 8);

// --- Rhythm generator ---
const rhythmOpts: RhythmOptions = { root: 2, bars: 2, lowHits: 4, highHits: 7, vary: true, seed: 4 };
const rhythm = generateRhythm(rhythmOpts);
expect("rhythm hit count = (low + high) × bars", rhythm.length, (4 + 7) * 2);
assert("rhythm notes are staccato", rhythm.every((n) => n.duration <= 0.25));
assert("rhythm notes stay within the loop", rhythm.every((n) => n.startTime + n.duration <= 2 * BEATS_PER_BAR + 1e-9));
assert("rhythm uses two pitches (low pulse + high tick)", new Set(rhythm.map((n) => n.pitch)).size === 2);
expect("same seed reproduces the same rhythm", generateRhythm(rhythmOpts), generateRhythm(rhythmOpts));
assert("rhythm vary=false has no probability", generateRhythm({ ...rhythmOpts, vary: false }).every((n) => n.probability === undefined));

// --- Bass generator ---
const bassBase: BassOptions = { root: 9, mode: "aeolian", bars: 4, style: "sustain", vary: false, seed: 1 };
const sustain = generateBass(bassBase);
expect("sustain bass is one held root", sustain.length, 1);
assert("sustain bass spans the whole loop", sustain[0].duration === 4 * BEATS_PER_BAR);
assert("bass sits in the low register (C1 area)", sustain.every((n) => n.pitch >= 33 && n.pitch <= 47));
const pulse = generateBass({ ...bassBase, style: "pulse" });
expect("pulse bass restates the root each beat", pulse.length, 4 * BEATS_PER_BAR);
assert("pulse bass is all one pitch (the root)", new Set(pulse.map((n) => n.pitch)).size === 1);
const walk = generateBass({ ...bassBase, style: "walk" });
expect("walk bass has two notes per bar", walk.length, 8);
assert("walk bass moves off the root", new Set(walk.map((n) => n.pitch)).size > 1);
assert("bass notes never spill past the loop", walk.every((n) => n.startTime + n.duration <= 4 * BEATS_PER_BAR + 1e-9));

// --- Perform track budget ---
expect("perform counts every optional layer", performTrackCount(true, 3, true, true, true, true, true), 8);
expect("perform bed off drops bed tracks", performTrackCount(false, 3, true, true, true, true, true), 5);
expect("perform everything off is zero", performTrackCount(false, 3, false, false, false, false, false), 0);
assert("full perform rig fits Push's 8-column grid", performTrackCount(true, 3, true, true, true, true, true) <= PUSH_GRID_WIDTH);

console.log(failures === 0 ? "\nAll ambient theory tests passed." : `\n${failures} test(s) failed.`);
if (failures > 0) process.exit(1);
