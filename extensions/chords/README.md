# chords

An Ableton Live 12 Extension for **mapping out chord progressions**. Pick a
**key** and **major/minor**, and Chords shows you every diatonic chord laid out
as a grid — **columns are the scale degrees (I–VII)**, **rows are variations**
(triad, 7th, sus2, sus4, 6th, add9). Click chords to build a progression, name
and save as many sections as you like (verse, chorus, bridge…), then **generate
the selected one onto the track's Arrangement timeline** as a MIDI clip.

Because it's an ordinary MIDI clip, you can edit, move, loop or resize it like
anything else in the Arrangement, and it plays through the track's instrument.

## Install (the easy way)

You don't need Node or the SDK just to use it:

1. Download `chords-<version>.ablx` from the
   [Releases page](https://github.com/superhighfives/ableton/releases).
2. In Live, open **Settings → Extensions** and drag the `.ablx` onto the page.
3. Enable it; restart Live if prompted.

**Use it:** create or select a **MIDI track**, right-click its title bar (or an
empty clip slot on it) → **Map Chords…**. Pick a key and mode, click chords into
a section, then **Generate**. The progression is written onto the track's
Arrangement timeline.

The rest of this README is for **developing** the extension from source.

## Why it works this way

The Extensions SDK has no real‑time MIDI output, no custom MIDI‑mappable
controls, and no persistent panel — it edits Live's data model (clips, tracks,
scenes). So instead of being a live instrument surface, Chords is a **planning
board that generates clips**, and leans on Live's native clip/scene launching
for playback and MIDI mapping.

## What it does

- Adds **Map Chords…** to the right‑click menu of any **MIDI track**. It
  **prefills from Live's current scale** (Scale Mode root + name).
- Shows a **grid of the diatonic chords** in the chosen key:
  - **Columns** — the seven scale degrees, headed with their Roman numeral
    (I, ii, iii, IV, V, vi, vii°) and the chord name for the current key.
  - **Rows** — variations that stay in the key: **Triad**, **7th** (diatonic
    maj7 / m7 / 7 / m7♭5), **sus2**, **sus4**, **6th**, **add9**.
- Lets you keep several named **sections** (Verse, Chorus, Bridge…) as tabs.
  Click a chord to append it to the active section; click a chip in the strip to
  remove it, or the 🗑 to clear the section.
- **Generate** writes the **currently selected** section onto the track's
  **Arrangement timeline** as one continuous clip — the chords laid end to end,
  starting after any existing clips (bar‑aligned). The clip takes the section's
  name. Open Arrangement view to see it along the timeline.
- **Adjacent identical chords merge** into one longer span: click `Bm Bm G D` in
  4/4 and you get a **2‑bar Bm, then a 1‑bar G and a 1‑bar D** in the clip.
- **Your work is remembered.** Three ways to close the dialog: **Generate**
  (write clips *and* save state), **Save** (save state, no clips), and
  **Cancel** (discard this session's edits — Escape does the same). Saved
  sections, names, key and options are restored next time you open it, so you
  don't lose progressions when the dialog closes. (The SDK has no per‑Set
  storage, so this is the last state globally, not stored inside a specific
  `.als`.)
- **Bar length per chord** is selectable — ½, 1, 2 or 4 bars (assumes 4/4).
- **Smart voicings** (on by default) — greedy voice‑leading that keeps common
  tones and moves the rest by the smallest step, so sections sound smooth. Turn
  it off for plain root‑position chords.
- Optionally **auto‑adds a built‑in instrument** (Drift by default) when the
  track is empty, so the chords make sound immediately.

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
`../../sdks/extensions-sdk-1.0.0-beta.0/` and the build tools from the registry.
`pnpm-workspace.yaml` already approves esbuild's build script.

Then in Live: **Settings → Extensions → enable Developer Mode**.

> The host path is set in `.env` (`EXTENSION_HOST_PATH`). Edit it if your Live
> app is named differently.

## Run it

```sh
pnpm start
```

Builds `src/extension.ts → dist/extension.js` and loads it into Live. Then in a
Live Set: right‑click a **MIDI track** → **Map Chords…**.

## Develop

```sh
pnpm test       # chord-maths sanity checks (no Live needed)
pnpm build:dev  # type-check + bundle with sourcemaps
pnpm build      # production (minified)
pnpm package    # build + create build/chords-<version>.ablx
```

## Source layout

- `src/theory.ts` — pure music theory: scales, the diatonic chord grid, chord
  variations, sequence→clip merging, and voice‑leading. No SDK imports, fully
  unit‑tested.
- `src/theory.test.ts` — sanity checks for the chord maths.
- `src/extension.ts` — Live integration: the context‑menu command, the dialog,
  and clip/scene generation.
- `src/interface.html` — the dialog UI (inlined into the bundle as a string).
