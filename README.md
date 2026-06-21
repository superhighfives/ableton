# Ableton Live Extensions

A workspace for **building and sharing Ableton Live 12 Extensions** — custom
JavaScript/TypeScript tools that extend Live using the
[Ableton Extensions SDK](https://ableton.github.io/extensions-sdk).

Extensions read and rewrite a Live Set — tracks, clips, MIDI, scenes, devices,
tempo and more — and are triggered from right-click menus inside Live. They run
on **Live 12.4.5 Suite (public beta)** or later.

---

## Extensions

| Extension | What it does | How you trigger it |
| --- | --- | --- |
| [**progressive**](progressive/) | Generates famous chord progressions (I–V–vi–IV, ii–V–I, 12-bar blues…) in any key/mode as MIDI chord clips, for songwriting. | Right-click a **MIDI track** → **Generate Progressions…** |
| [**reverse-midi**](reverse-midi/) | Reverses the timing of every note in a MIDI clip, within the span of the existing notes, as one undo step. | Right-click a **MIDI clip** → **Reverse Notes** |

Each extension folder has its own README with full detail.

---

## Install a released extension (for users)

You don't need Node, the SDK, or Developer Mode to *use* an extension — only to
develop one. To install a packaged `.ablx`:

1. **Download the `.ablx`** for the extension you want from the
   [Releases page](https://github.com/superhighfives/ableton/releases)
   (e.g. `progressive-1.0.0.ablx`).
2. In Live, open **Settings → Extensions** (Live 12.4.5 Suite beta or later).
3. **Drag the `.ablx` onto the Extensions page** (or use its install control).
4. Enable the extension in the list. Restart Live if prompted.

### Then initialize it in a Set

Extensions surface as **right-click actions** — there's no separate window to
open. Once installed and enabled:

- **progressive** — create or select a **MIDI track**, right-click its title
  bar (or an empty clip slot on it) → **Generate Progressions…**. Pick a key,
  mode, progression, voicing and output, then **Generate**. It writes the chords
  as Session clips (launchable and MIDI-mappable via Live's **MIDI Map mode**,
  ⌘M) or as an Arrangement row. See [progressive/README.md](progressive/README.md).
- **reverse-midi** — right-click any **MIDI clip** → **Reverse Notes**. See
  [reverse-midi/README.md](reverse-midi/README.md).

---

## Develop the extensions

### Requirements

- **Ableton Live 12.4.5 Suite Beta** — Extensions are Suite + beta only.
- **Node.js ≥ 22.11** (the SDK suggests the v24 LTS).
- **pnpm** — `npm i -g pnpm`, or `corepack enable pnpm`.
- **The Extensions SDK** — not included in this repo (see below).

### Download the SDK

Ableton's license forbids redistributing the SDK, so `extensions-sdk-*/` is
**gitignored** and you download it yourself. The projects reference its `.tgz`
packages via relative paths.

1. Join the Ableton Beta program at <https://www.ableton.com/en/beta/> and sign
   in to the Centercode portal you're invited to.
2. From the SDK release page, download:
   - **Ableton Live 12.4.5 Beta** (Suite) and install it.
   - **`extensions-sdk-<version>.zip`** — the SDK distribution.
3. Extract the zip into this folder so `extensions-sdk-1.0.0-beta.0/` sits next
   to `progressive/` and `reverse-midi/`. It holds the `.tgz` packages (SDK,
   CLI, project creator), docs, API reference, and official examples.

Start with `extensions-sdk-1.0.0-beta.0/docs/` or the online docs at
<https://ableton.github.io/extensions-sdk>.

### Run an extension in Live

In Live, enable **Settings → Extensions → Developer Mode** first (without it the
CLI can't connect). Then, from an extension folder:

```sh
pnpm install    # pulls the SDK + CLI from the local .tgz files, plus build tools
pnpm start      # builds and loads the extension into Live's Extension Host
```

`pnpm start` keeps running and streams the extension's `console.log` output to
your terminal — handy for debugging. The host path comes from a per-machine
`.env` (`EXTENSION_HOST_PATH`); it's gitignored, so set yours.

### Common scripts

Run these from an extension folder. Not every extension defines every script —
check its `package.json`.

| Script | Does |
| --- | --- |
| `pnpm start` | Build (dev) and load into Live's Extension Host. |
| `pnpm build:dev` | Type-check and bundle with sourcemaps. |
| `pnpm build` | Production build (minified, no sourcemaps). |
| `pnpm test` | Run the extension's unit tests, where present (e.g. progressive's chord maths). |
| `pnpm package` | Build, then write a shareable `.ablx` to `build/`. |

---

## Create a new extension

Scaffold a fresh project with the SDK's project creator:

```sh
mkdir my-extension && cd my-extension
pnpm dlx file:../extensions-sdk-1.0.0-beta.0/ableton-create-extension-1.0.0-beta.0.tgz
```

It asks for a name, author, and your Live install, then writes a ready-to-run
project. The existing extensions here are also good starting templates.

> The scaffolder writes npm-style scripts. If you run them with pnpm, add a
> `pnpm-workspace.yaml` with `allowBuilds: { esbuild: true }` so pnpm runs
> esbuild's postinstall (see any extension folder for an example).

---

## Releases

Each extension is released **independently**, with its own tag and a `.ablx`
attached as a downloadable asset:

- Tags are named `<extension>-<version>`, e.g. `progressive-1.0.0`,
  `reverse-midi-1.0.0`.
- The version matches the extension's `manifest.json` / `package.json`.

To cut a release for an extension:

```sh
cd <extension>
pnpm package                                   # writes build/<extension>-<version>.ablx
gh release create <extension>-<version> \
  build/<extension>-<version>.ablx \
  --title "<extension> <version>" \
  --notes "…"
```

---

## Repo layout & notes

```
ableton/
├── progressive/                 # chord-progression generator extension
├── reverse-midi/                # MIDI-clip note reverser extension
└── extensions-sdk-1.0.0-beta.0/ # SDK (downloaded separately, gitignored)
```

- **`.env`** holds the machine-specific path to Live's Extension Host and is
  gitignored — set yours per machine.
- **`node_modules/`**, **`dist/`**, and **`build/`** are build artifacts and are
  not tracked. The esbuild binary is platform-specific, so run `pnpm install` on
  each machine.
