# textures

Generates ambient textures with [Stable Audio 2.5 on Replicate](https://replicate.com/stability-ai/stable-audio-2.5)
and drops them into Live's User Library, so they show up in the browser under
**User Library → Samples → AI Textures**.

Each prompt becomes a 48 kHz 24-bit WAV named `date_slug_seed.wav`, plus a JSON
sidecar with the prompt, seed, settings and Replicate prediction ID.

## Setup

- `REPLICATE_API_TOKEN` in your environment
- `ffmpeg` on your PATH (for the WAV conversion)

No Python packages needed.

## Usage

```sh
# Check what would run, without calling Replicate
uv run textures/gen_textures.py textures/prompts.txt --dry-run

# Three short test clips
uv run textures/gen_textures.py textures/prompts.txt --duration 10 --limit 3

# Full set, one minute each
uv run textures/gen_textures.py textures/prompts.txt --duration 60
```

| Flag | Default | Notes |
| --- | --- | --- |
| `--duration` | 60 | Seconds, 1 to 190 |
| `--seed` | random | Fixed seed for every prompt; reuse one from a sidecar to recreate a clip |
| `--steps` | 8 | 4 to 8; fewer is faster and rougher |
| `--cfg` | 1 | Prompt adherence, 1 to 25 |
| `--limit` | all | Only the first N prompts |
| `--out` | AI Textures folder | Output folder |

Edit `prompts.txt` (one prompt per line, `#` for comments). "No melody" and
"no drums" help keep textures out of the way of a chord bed.
