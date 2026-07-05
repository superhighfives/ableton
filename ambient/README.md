# ambient

An Ableton Live 12 Extension for writing **generative ambient soundscapes**.
Right-click a **MIDI track** → **Generate Ambient…** to open a tabbed dialog,
pick a key/mode and a generator, and it writes looping MIDI clips — building the
tracks, scenes, and (optionally) a tuned reverb + delay chain for you.

Everything is generated as ordinary Live clips and devices, so nothing is
locked up: tweak the notes, swap the instrument, remap the harmony.

## Generators

| Tab | What it makes | Idea |
| --- | --- | --- |
| **Drift** | N looping clips of **coprime bar lengths** (3, 5, 7, 11…), one per track, all in one scene. | The loops realign only after the product of their lengths, so a handful of short clips never repeat their combined state for hours — Eno's _Music for Airports_ trick. |
| **Bloom** | An **evolving chord progression**: one clip per scene on a single track, launched in turn. | Each scene holds one diatonic chord a scale-step along the chosen motion; the register layers become the wide vertical voicing of that one clip. |
| **Aleatoric** | One long clip **scattered by probability** — off-grid, humanized, drawn from the key. | A self-contained generative shimmer, weighted toward chord tones and re-shuffled every loop. Density, register, note length and weighting are all adjustable. |
| **Play** | Turns the track into a **ready-to-play instrument** — instrument + FX, an optional Arpeggiator, armed for Push's Note mode. No clips. | The voice you play live over the loops, in tune with the current key. |
| **Perform** | A **Push-ready rig**: a Drift bed + a Bloom progression + an Aleatoric shimmer + a Play instrument, in one key. | Assembles all four into the loops-plus-instrument setup for live playing (see below). |

Drift, Bloom, Aleatoric and Play each set up one "instrument" (a track); **Perform**
composes all four into a single rig.

The generators use Live's **per-note probability** and **velocity drift** (the
"Evolve" option) so the texture keeps shifting on every loop rather than
repeating exactly.

## Playing live (Perform + Push)

The **Perform** tab builds a whole rig in the current key, laid out for the
Ableton Push (or any Session workflow):

- a **Drift bed** (one track per phasing layer) with its loops in the first scene,
- a **Bloom progression** down a single track's column,
- an optional **Aleatoric shimmer** clip alongside the bed in the first scene,
- an **armed play instrument** track — empty, ready for Push's Note mode (the
  same setup the **Play** tab builds on its own).

Each layer is optional, and the whole rig stays within Push's 8-column grid.

The extension doesn't talk to Push directly — it doesn't need to. Push is a live
view of the Live Set, so everything generated (clips, scenes, colours) shows up
and is playable on the hardware. A couple of things stay in your hands: **set
Live's scale first** (the SDK can read it but not set it — everything generates
in-key to match), and **advance chords by tapping the Bloom pads** rather than
launching whole scenes (a scene launch would stop the bed; a clip launch leaves
it running). To start: launch the first scene (bed + first chord), then tap down
the Bloom column while you play over the top on the armed track.

### Modes

The Key chooser offers modes suited to ambient — Lydian, Ionian, Mixolydian,
Dorian, Aeolian, Phrygian, and the two pentatonics — and prefills from Live's
current scale. Every generated note is snapped into the chosen key.

### Sound

With **Add reverb & delay** on, each track gets its chosen instrument followed
by a Reverb and a Delay, tuned wetter than their defaults so a launched clip
already sounds ambient. Device and parameter tuning is best-effort — if a device
name or parameter differs in your Live build, the clip still generates; you just
add the effects yourself.

## Install (the easy way)

You don't need Node or the SDK just to use it:

1. Download `ambient-<version>.ablx` from the
   [Releases page](https://github.com/superhighfives/ableton/releases).
2. In Live, open **Settings → Extensions** and drag the `.ablx` onto the page.
3. Enable it; restart Live if prompted.

**Use it:** right-click a **MIDI track** → **Generate Ambient…**, choose a
generator, then **Generate**. Switch to Session view (Tab) and launch the new
scene(s).

The rest of this README is for **developing** the extension from source.

## Requirements

- Ableton Live 12.4.5 Suite **Beta** (Extensions are Suite + beta only)
- Node.js ≥ 22.11 (the SDK suggests v24 LTS)
- pnpm (`npm i -g pnpm`, or via `corepack enable pnpm`)

## One-time setup

From this folder:

```sh
pnpm install
```

This pulls the Ableton SDK + CLI from the local `.tgz` files in
`../extensions-sdk-1.0.0-beta.0/` and the build tools from the registry.
`pnpm-workspace.yaml` already approves esbuild's build script, which pnpm
otherwise blocks by default.

Then in Live: **Settings → Extensions → enable Developer Mode**. Without it,
`npm start` cannot connect.

> The host path is set in `.env` (`EXTENSION_HOST_PATH`). If your app is named
> differently, edit `.env`.

## Run it

```sh
pnpm start
```

This builds `src/extension.ts → dist/extension.js` and loads it into Live. You
should see `ambient extension activated.` in the terminal. Right-click a MIDI
track → **Generate Ambient…**.

## Test

```sh
pnpm test
```

Runs the music-theory checks (`src/theory.test.ts`) outside Live — scale
snapping, coprime phasing lengths, voicings, chord building, motion shapes, and
the generators' output. Pure functions only, so no Live required.

## Scripts

| Script           | What it does                                 |
| ---------------- | -------------------------------------------- |
| `pnpm start`     | Dev build + load into Live's Extension Host  |
| `pnpm test`      | Run the theory unit tests                    |
| `pnpm build:dev` | Dev bundle (sourcemaps)                      |
| `pnpm build`     | Production bundle (minified)                 |
| `pnpm package`   | Production build → shareable `.ablx` archive |

## Files

- `src/extension.ts` — the extension: context-menu action, dialog, and the
  Drift/Bloom/Perform track-and-clip builders
- `src/theory.ts` — pure, testable music theory: modes, voicings, phasing
  lengths, chords, motion, and the generators
- `src/theory.test.ts` — theory unit tests (`pnpm test`)
- `src/interface.html` — the tabbed dialog, inlined into the bundle as a string
- `manifest.json` — name, entry point, API version Live reads
- `build.ts` — esbuild bundler (single-file CJS output)
- `.env` — path to Live's Extension Host (gitignored, machine-specific)
