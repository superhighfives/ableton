# reverse-midi

A minimal Ableton Live 12 Extension. Adds a **Reverse Notes** action to the
right-click menu of any MIDI clip. It mirrors every note's timing within the
span of the existing notes (earliest start → latest end), preserving each
note's pitch and duration, as a single undo step.

## Install (the easy way)

You don't need Node or the SDK just to use it:

1. Download `reverse-midi-<version>.ablx` from the
   [Releases page](https://github.com/superhighfives/ableton/releases).
2. In Live, open **Settings → Extensions** and drag the `.ablx` onto the page.
3. Enable it; restart Live if prompted.

**Use it:** right-click any **MIDI clip** with notes → **Reverse Notes**. The
notes flip end-to-front in one undo step (⌘Z to revert).

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

> The host path is set in `.env` (`EXTENSION_HOST_PATH`). It currently points at
> `/Applications/Ableton Live 12 Beta.app/...`. If your app is named differently,
> edit `.env`.

## Run it

```sh
pnpm start
```

This builds `src/extension.ts → dist/extension.js` and loads it into Live. You
should see `reverse-midi extension activated.` in the terminal.

Then in Live:

1. Add a MIDI clip with a few notes (Session or Arrangement).
2. Right-click the clip → **Reverse Notes**.
3. The notes flip end-to-front. Ctrl/Cmd-Z undoes it in one step.

## Scripts

| Script             | What it does                                 |
| ------------------ | -------------------------------------------- |
| `pnpm start`       | Dev build + load into Live's Extension Host  |
| `pnpm build:dev`   | Dev bundle (sourcemaps)                       |
| `pnpm build`       | Production bundle (minified)                  |
| `pnpm package`     | Production build → shareable `.ablx` archive |

## Files

- `src/extension.ts` — the extension (context-menu action + reverse logic)
- `manifest.json` — name, entry point, API version Live reads
- `build.ts` — esbuild bundler (single-file CJS output)
- `.env` — path to Live's Extension Host (gitignored, machine-specific)
