# ableton

A workspace for **exploring, creating, and sharing Ableton Live Extensions** —
custom JavaScript/TypeScript tools that extend Live 12 using the
[Ableton Extensions SDK](https://ableton.github.io/extensions-sdk).

Extensions can read and rewrite a Live Set — tracks, clips, MIDI, devices,
tempo and more — and are triggered straight from the right-click menu inside
Live. They run on **Live 12.4.5 Suite (public beta)** or later.

## What's in here

- **`reverse-midi/`** — a small working extension. It adds a **Reverse Notes**
  action to any MIDI clip's right-click menu, flipping note timing in a single
  undo step. A good template for new extensions.

> **The SDK itself is not included in this repo.** Ableton's SDK license
> forbids redistributing the Extensions SDK, so `extensions-sdk-*/` is
> gitignored. You download it yourself (see below). The projects here reference
> its `.tgz` packages via relative paths.

## Downloading the SDK

The SDK and the Live beta it requires are distributed through Ableton's beta
program on Centercode:

1. Join the Ableton Beta program at <https://www.ableton.com/en/beta/> and sign
   in to the Centercode portal you're invited to.
2. From the SDK release page on Centercode, download:
   - **Ableton Live 12.4.5 Beta** (Suite) and install it.
   - **`extensions-sdk-<version>.zip`** — the SDK distribution.
3. Extract the zip into this folder so you have
   `extensions-sdk-1.0.0-beta.0/` sitting next to `reverse-midi/`. That folder
   holds the `.tgz` packages (SDK, CLI, project creator), the docs, the API
   reference, and the official examples.

Start with `extensions-sdk-1.0.0-beta.0/docs/` (or the online docs at
<https://ableton.github.io/extensions-sdk>) for the full guide.

## Getting started

You'll need:

- Ableton Live 12.4.5 Suite Beta (Extensions are Suite + beta only)
- Node.js ≥ 22.11 (the SDK suggests the v24 LTS)

Then, working from an extension folder (e.g. `reverse-midi/`):

```sh
npm install     # pulls the SDK + CLI from the local .tgz files, plus build tools
npm start       # builds and loads the extension into Live's Extension Host
```

Enable **Developer Mode** in Live under *Settings → Extensions* first, or
`npm start` can't connect.

## Creating a new extension

Scaffold a fresh project with the SDK's project creator:

```sh
mkdir my-extension && cd my-extension
npx file:../extensions-sdk-1.0.0-beta.0/ableton-create-extension-1.0.0-beta.0.tgz
```

It asks for a name, author, and your Live install, then writes a ready-to-run
project. See the docs in `extensions-sdk-1.0.0-beta.0/docs/` for the full guide.

## Sharing an extension

From an extension folder:

```sh
npm run package   # builds, then writes a shareable .ablx archive
```

A user installs the resulting `.ablx` by dropping it onto the Extensions page in
Live's settings.

## Notes

- `.env` files hold a machine-specific path to Live's Extension Host and are
  gitignored — set yours per machine.
- `node_modules/` and `dist/` are build artifacts and are not tracked. The
  esbuild binary is platform-specific, so run `npm install` on each machine.
