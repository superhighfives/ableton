#!/usr/bin/env python3
"""Generate ambient textures with Stable Audio 2.5 on Replicate.

Reads prompts (one per line, # for comments), runs each through
stability-ai/stable-audio-2.5, and saves a 48 kHz 24-bit WAV plus a JSON
sidecar into Live's User Library so the clips show up in the browser.

With --key, each result is checked for that key and regenerated (up to
--tries times) when it misses, since the model often ignores the key.

    uv run textures/gen_textures.py textures/prompts.txt --duration 10 --limit 3
"""

import argparse
import datetime
import json
import math
import os
import random
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

MODEL = "stability-ai/stable-audio-2.5"
API = "https://api.replicate.com/v1"
DEFAULT_OUT = Path.home() / "Music/Ableton/User Library/Samples/AI Textures"
# Replicate's Cloudflare front rejects urllib's default User-Agent (error 1010).
USER_AGENT = "gen-textures/1.0"

NOTES = "C C# D D# E F F# G G# A A# B".split()
FLATS = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}
# Krumhansl-Kessler key profiles, starting from the tonic.
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
ANALYSIS_RATE = 4000


def api(method, url, token, body=None, wait=False):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json",
               "User-Agent": USER_AGENT}
    if wait:
        # Hold the request open until the prediction finishes (up to 60 s).
        headers["Prefer"] = "wait"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"Replicate API error {e.code}: {e.read().decode(errors='replace')}")


def run_prediction(token, inputs):
    pred = api("POST", f"{API}/models/{MODEL}/predictions", token, {"input": inputs}, wait=True)
    while pred["status"] not in ("succeeded", "failed", "canceled"):
        time.sleep(2)
        pred = api("GET", pred["urls"]["get"], token)
    if pred["status"] != "succeeded":
        raise RuntimeError(f"prediction {pred['id']} {pred['status']}: {pred.get('error')}")
    return pred


def slugify(text, limit=40):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:limit].rstrip("-") or "texture"


def read_prompts(path):
    lines = Path(path).read_text().splitlines()
    return [l.strip() for l in lines if l.strip() and not l.strip().startswith("#")]


def to_wav(src, dest):
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src),
         "-ar", "48000", "-c:a", "pcm_s24le", str(dest)],
        check=True,
    )


def parse_key(text):
    """"D minor" -> (2, "minor"); "Bb" -> (10, None). None if unrecognised."""
    m = re.fullmatch(r"\s*([A-Ga-g])([#b]?)\s*(major|minor|maj|min|m)?\s*", text)
    if not m:
        return None
    name = m.group(1).upper() + m.group(2)
    tonic = NOTES.index(FLATS.get(name, name))
    mode = {"major": "major", "maj": "major", "minor": "minor", "min": "minor", "m": "minor"}.get(m.group(3))
    return tonic, mode


def chroma(path):
    """Energy per pitch class (C2-B5), via Goertzel filters on a mono downmix."""
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1",
         "-ar", str(ANALYSIS_RATE), "-f", "s16le", "-"],
        capture_output=True, check=True,
    ).stdout
    samples = struct.unpack(f"<{len(raw) // 2}h", raw)
    energy = [0.0] * 12
    for midi in range(36, 84):
        coeff = 2 * math.cos(2 * math.pi * 440 * 2 ** ((midi - 69) / 12) / ANALYSIS_RATE)
        for start in range(0, len(samples) - 2048, ANALYSIS_RATE // 2):
            s1 = s2 = 0.0
            for v in samples[start:start + 2048]:
                s1, s2 = v + coeff * s1 - s2, s1
            energy[midi % 12] += s1 * s1 + s2 * s2 - coeff * s1 * s2
    return energy


def correlation(a, b):
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    return num / den if den else 0.0


def check_key(energy, tonic, mode):
    """Return (matches, estimated key name, score for the target key)."""
    def score(t, profile):
        return correlation([energy[(t + i) % 12] for i in range(12)], profile)

    best = max(((score(t, prof), NOTES[t] + suffix) for t in range(12)
                for prof, suffix in ((MAJOR_PROFILE, " major"), (MINOR_PROFILE, " minor"))))
    # The tonic should be among the two strongest notes (the other is often the fifth).
    # With a mode, its third should beat the other third and the best-fitting key
    # should be the target itself.
    strongest = sorted(range(12), key=lambda i: -energy[i])[:2]
    minor_third, major_third = energy[(tonic + 3) % 12], energy[(tonic + 4) % 12]
    ok = tonic in strongest
    if mode:
        thirds_ok = minor_third > major_third if mode == "minor" else major_third > minor_third
        ok = ok and thirds_ok and best[1] == f"{NOTES[tonic]} {mode}"
    target = score(tonic, MINOR_PROFILE if mode == "minor" else MAJOR_PROFILE)
    return ok, best[1], target


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("prompts", help="text file, one prompt per line")
    p.add_argument("--duration", type=int, default=60, help="seconds, 1-190 (default 60)")
    p.add_argument("--key", help='key added to every prompt and checked afterwards, e.g. "D minor" or "D"')
    p.add_argument("--bpm", type=int, help="tempo added to every prompt, e.g. 70")
    p.add_argument("--tries", type=int, default=3, help="attempts per prompt to hit --key (default 3)")
    p.add_argument("--seed", type=int, help="fixed seed for every prompt (default: random per prompt)")
    p.add_argument("--steps", type=int, default=8, help="diffusion steps, 4-8 (default 8)")
    p.add_argument("--cfg", type=float, default=1.0, help="prompt adherence, 1-25 (default 1)")
    p.add_argument("--limit", type=int, help="only run the first N prompts")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output folder (default {DEFAULT_OUT})")
    p.add_argument("--dry-run", action="store_true", help="print what would run, call nothing")
    args = p.parse_args()

    if not 1 <= args.duration <= 190:
        p.error("--duration must be 1-190")
    if not 4 <= args.steps <= 8:
        p.error("--steps must be 4-8")
    key = parse_key(args.key) if args.key else None
    if args.key and not key:
        p.error(f'--key not recognised: "{args.key}" (try "D minor", "Bb major" or "D")')
    # A fixed seed gives the same audio every time, so retrying can't help.
    tries = 1 if (not key or args.seed is not None) else max(1, args.tries)

    prompts = read_prompts(args.prompts)[: args.limit]
    if not prompts:
        p.error(f"no prompts in {args.prompts}")

    token = os.environ.get("REPLICATE_API_TOKEN")
    if not args.dry_run:
        if not token:
            sys.exit("REPLICATE_API_TOKEN is not set")
        if not shutil.which("ffmpeg"):
            sys.exit("ffmpeg not found on PATH")
        args.out.mkdir(parents=True, exist_ok=True)

    # Stable Audio reads key and tempo from the prompt text itself.
    suffix = "".join(f", {s}" for s in (args.key and f"in {args.key}", args.bpm and f"{args.bpm} BPM") if s)
    tags = "".join(f"_{s}" for s in (args.key and slugify(args.key, 12).replace("-", ""),
                                     args.bpm and f"{args.bpm}bpm") if s)

    today = datetime.date.today().isoformat()
    total_time = 0.0
    for i, base in enumerate(prompts, 1):
        prompt = base + suffix
        print(f"[{i}/{len(prompts)}] {args.duration}s: {prompt}")
        if args.dry_run:
            print(f"    -> {args.out / today}_{slugify(base)}{tags}_<seed>.wav")
            continue

        with tempfile.TemporaryDirectory() as tmp:
            best = None  # (target score, seed, wav path, pred, estimate)
            for attempt in range(1, tries + 1):
                seed = args.seed if args.seed is not None else random.randint(0, 2**31 - 1)
                inputs = {"prompt": prompt, "duration": args.duration, "seed": seed,
                          "steps": args.steps, "cfg_scale": args.cfg}
                pred = run_prediction(token, inputs)
                pred["input_sent"] = inputs
                total_time += (pred.get("metrics") or {}).get("predict_time") or 0

                raw, wav = Path(tmp) / f"raw{attempt}", Path(tmp) / f"take{attempt}.wav"
                req = urllib.request.Request(pred["output"], headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    raw.write_bytes(resp.read())
                to_wav(raw, wav)

                if not key:
                    best = (0, seed, wav, pred, None, True)
                    break
                ok, estimate, target = check_key(chroma(wav), *key)
                print(f"    try {attempt}: seed {seed} sounds like {estimate}" + (" - match" if ok else ""))
                if ok:
                    best = (target, seed, wav, pred, estimate, True)
                    break
                if best is None or target > best[0]:
                    best = (target, seed, wav, pred, estimate, False)

            _, seed, wav, pred, estimate, matched = best
            name = f"{today}_{slugify(base)}{tags}_{seed}" + ("" if matched else "_offkey")
            shutil.move(wav, args.out / f"{name}.wav")

        meta = {"prompt": prompt, "key": args.key, "bpm": args.bpm,
                "estimated_key": estimate, "key_match": matched if key else None,
                "model": MODEL, "version": pred.get("version"), "prediction_id": pred["id"],
                "input": pred["input_sent"], "predict_time_s": (pred.get("metrics") or {}).get("predict_time"),
                "created_at": pred.get("created_at")}
        (args.out / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n")
        print(f"    saved {name}.wav" + ("" if matched else f" (closest of {tries}, still off-key)"))

    if not args.dry_run:
        print(f"\nDone. Total predict time {total_time:.1f} s. "
              "Check replicate.com/account/billing for what that cost.")


if __name__ == "__main__":
    main()
