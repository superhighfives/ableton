#!/usr/bin/env python3
"""Generate ambient textures with Stable Audio 2.5 on Replicate.

Reads prompts (one per line, # for comments), runs each through
stability-ai/stable-audio-2.5, and saves a 48 kHz 24-bit WAV plus a JSON
sidecar into Live's User Library so the clips show up in the browser.

    uv run textures/gen_textures.py textures/prompts.txt --duration 10 --limit 3
"""

import argparse
import datetime
import json
import os
import random
import re
import shutil
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


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("prompts", help="text file, one prompt per line")
    p.add_argument("--duration", type=int, default=60, help="seconds, 1-190 (default 60)")
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

    today = datetime.date.today().isoformat()
    total_time = 0.0
    for i, prompt in enumerate(prompts, 1):
        seed = args.seed if args.seed is not None else random.randint(0, 2**31 - 1)
        name = f"{today}_{slugify(prompt)}_{seed}"
        inputs = {"prompt": prompt, "duration": args.duration, "seed": seed,
                  "steps": args.steps, "cfg_scale": args.cfg}
        print(f"[{i}/{len(prompts)}] {args.duration}s seed {seed}: {prompt}")
        if args.dry_run:
            print(f"    -> {args.out / name}.wav")
            continue

        pred = run_prediction(token, inputs)
        predict_time = (pred.get("metrics") or {}).get("predict_time")
        total_time += predict_time or 0

        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            req = urllib.request.Request(pred["output"], headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw.write_bytes(resp.read())
            to_wav(raw, args.out / f"{name}.wav")

        meta = {"prompt": prompt, "model": MODEL, "version": pred.get("version"),
                "prediction_id": pred["id"], "input": inputs,
                "predict_time_s": predict_time, "created_at": pred.get("created_at")}
        (args.out / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n")
        print(f"    saved {name}.wav ({predict_time or '?'} s on Replicate)")

    if not args.dry_run:
        print(f"\nDone. Total predict time {total_time:.1f} s. "
              "Check replicate.com/account/billing for what that cost.")


if __name__ == "__main__":
    main()
