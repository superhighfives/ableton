# sounds

**Fog & Pulse**, a step-by-step course in music production with Ableton Live 12,
at [sounds.charliegleason.com](https://sounds.charliegleason.com). A companion to
[Chords](https://chords.charliegleason.com).

Built with TanStack Start on Cloudflare Workers, deployed with the `cf` CLI like
Chords. Every push to `main` that touches `sounds/` checks, builds and deploys it
(`.github/workflows/sounds.yml`); pull requests are checked and dry-run only.

## Content

The course is plain data in `src/content/`:

- **`themes.tsx`**: six themes, each a list of `lessons` plus `planned` titles
  still to write. A lesson is an `id`, a `title` and a `Body` component. To add
  one, append it to `lessons` and remove its title from `planned`.
- **`recipes.tsx`**: short tutorials that rebuild one sound from a real record.
  Cite where any claim about the record comes from.

Lessons build from the components in `src/components/ui.tsx` (`Sheet`, `Row`,
`Cell`, `Steps`, `Task`, `Note`, `KeyBox`) and the diagrams in
`src/components/diagrams.tsx`. Anything that depends on the key or tempo reads
`useValues()`, so it follows the controls in the header.

When a theme or recipe lands, add a line to the edition log in
`src/routes/index.tsx`.

Key, tempo and lesson progress save in each visitor's browser (localStorage);
there's no backend.

## Develop

```sh
pnpm install
pnpm dev        # cf dev: the app in the local Workers runtime
pnpm typecheck
pnpm build      # cf build, into .cloudflare/
```

## Deploy

`cloudflare.config.ts` names the Worker and its domain. Deploys run from GitHub
Actions with the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, shared with Chords. The domain makes Cloudflare create
the DNS record and certificate on the first deploy.

To deploy by hand: `pnpm run deploy` (not `pnpm deploy`, which is a pnpm
built-in).
