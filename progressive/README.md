# progressive

An Ableton Live 12 Extension for songwriting. Pick a **key** and **major/minor**,
choose some famous **chord progressions** (I–V–vi–IV, ii–V–I, 12‑bar blues…),
and Progressive lays each chord out as a **looping Session clip** on a MIDI track —
grouped by progression, colour‑coded, ready to play.

Because they're ordinary Session clips, every chord (and every progression) is
**MIDI‑mappable and key‑mappable through Live's own MIDI Map mode**, and launching
a clip plays the chord through the track's instrument. No extra setup — just map
your controller and start writing.

## Why it works this way

The Extensions SDK has no real‑time MIDI output, no custom MIDI‑mappable controls,
and no persistent panel — it edits Live's data model (clips, tracks, scenes). So
instead of being a live instrument surface, Progressive **generates clips** and
leans on Live's native clip/scene launching for playback and MIDI mapping. The
result is the same goal — press a button, hear the chord, map it to hardware —
achieved through Live's own features.

## What it does

- Adds **Generate Progressions…** to the right‑click menu of any **MIDI track**.
- Opens a dialog to choose key, mode, progressions, and voicing. It **prefills
  from Live's current scale** (Scale Mode root + name).
- Writes one chord clip per chord into the track, in your chosen **output**:
  - **Session clips** — chords fill the track's slots top‑down (reusing empty
    scenes, creating new ones only when needed). Each progression is a coloured
    group with its name on the first scene. Every clip is launchable and
    MIDI‑mappable.
  - **Arrangement row** — chords laid end to end along the timeline, starting
    after any existing clips on the track (bar‑aligned).
- **Chord length** is selectable — ½, 1, 2, or 4 bars (assumes 4/4).
- Optionally **auto‑adds a built‑in instrument** (Drift by default) when the
  track is empty, so the chords make sound immediately.

### Voicing options

- **Triads** by default (root / third / fifth).
- **Add 7ths** — diatonic four‑note chords (m7, 7, maj7, m7♭5, dim7).
- **Smart voicings** — greedy voice‑leading that keeps common tones and moves
  the rest by the smallest step, so progressions sound smooth rather than jumpy.

### Included progressions

**Major:** Pop axis (I–V–vi–IV), 50s doo‑wop (I–vi–IV–V), vi–IV–I–V,
three‑chord (I–IV–V), jazz (ii–V–I), Pachelbel, 12‑bar blues.

**Minor:** Pop minor (i–VI–III–VII), Andalusian (i–VII–VI–v), i–iv–v,
lament (i–VI–VII), epic (i–iv–VII–III), 12‑bar blues.

## Requirements

- Ableton Live 12.4.5 Suite **Beta** (Extensions are Suite + beta only)
- Node.js ≥ 22.11 (the SDK suggests v24 LTS)
- pnpm (`npm i -g pnpm`, or via `corepack enable pnpm`)

## One‑time setup

From this folder:

```sh
pnpm install
```

This pulls the Ableton SDK + CLI from the local `.tgz` files in
`../extensions-sdk-1.0.0-beta.0/` and the build tools from the registry.
`pnpm-workspace.yaml` already approves esbuild's build script.

Then in Live: **Settings → Extensions → enable Developer Mode**.

> The host path is set in `.env` (`EXTENSION_HOST_PATH`). Edit it if your Live
> app is named differently.

## Run it

```sh
pnpm start
```

Builds `src/extension.ts → dist/extension.js` and loads it into Live. Then in a
Live Set: right‑click a **MIDI track** → **Generate Progressions…**.

## Develop

```sh
pnpm test       # chord-maths sanity checks (no Live needed)
pnpm build:dev  # type-check + bundle with sourcemaps
pnpm build      # production (minified)
pnpm package    # build + create build/progressive-<version>.ablx
```

## Source layout

- `src/theory.ts` — pure music theory: scales, the progression catalog, chord
  building, and voice‑leading. No SDK imports, fully unit‑tested.
- `src/theory.test.ts` — sanity checks for the chord maths.
- `src/extension.ts` — Live integration: the context‑menu command, the dialog,
  and clip/scene generation.
- `src/interface.html` — the dialog UI (inlined into the bundle as a string).
