#!/usr/bin/env python3
"""
Check a timeline, and optionally sharpen its boundaries.

Checking answers the questions that matter before anyone trusts the file:
does every event name a word that is on that page, do the marks run forwards,
how much of the page is covered, and does the text read back as the page's own
opening words. A timeline that is wrong is worse than one that is missing,
because every drill downstream trusts it in silence.

Sharpening (--snap) moves each mark to the quietest moment near it. A reciter
leaves a dip in energy between words; the aligner returns the frame where the
next letter becomes likely, which is usually a few tens of milliseconds late.
Snapping to the local minimum puts the boundary in the gap, where the ear
expects it. It never moves a mark past its neighbours.

    python scripts/python/check_timeline.py --pages 553 554 --audio ~/audio/062.mp3
    python scripts/python/check_timeline.py --pages 553 --audio ~/audio/062.mp3 --snap
    python scripts/python/check_timeline.py --pages 553 --clip 12 20 --out sample.wav
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ANNOTATIONS = REPO / "public" / "annotations"
TIMELINES = REPO / "public" / "timeline"
SAMPLE_RATE = 16_000

# Almost every line this prints is Arabic, and a Windows console defaults to a
# codepage that cannot encode it — without this the tool dies on its first word.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def words_of(page: int) -> dict[int, str]:
    raw = load_json(ANNOTATIONS / f"{page}.json")
    words = raw if isinstance(raw, list) else raw.get("words", [])
    return {int(w["id"]): str(w.get("text", "")) for w in words if w.get("id") is not None}


def report(page: int) -> tuple[dict, bool]:
    timeline = load_json(TIMELINES / f"{page}.json")
    known = words_of(page)
    # A page that straddles two surahs is recited in two files; check both.
    parts = timeline.get("parts") or [timeline]
    events = [e for part in parts for e in part.get("events", [])]
    if len(parts) > 1:
        print(f"page {page}: {len(parts)} recordings — "
              + ", ".join(f"{p['audio']} ({len(p['events'])} words)" for p in parts))

    unmatched = [e for e in events if e["w"] not in known]
    # Each part counts from its own start, so order is only meaningful inside one.
    backwards = [
        e
        for part in parts
        for i, e in enumerate(part.get("events", []))
        if i and e["t"] < part["events"][i - 1]["t"]
    ]
    gaps = [
        b["t"] - a["t"]
        for part in parts
        for a, b in zip(part.get("events", []), part.get("events", [])[1:])
    ]

    print(f"page {page}: {len(events)} events for {len(known)} words, audio {timeline.get('audio')}")
    print(f"   opens: {' '.join(known.get(e['w'], '?') for e in events[:6])}")
    print(f"   ends : {' '.join(known.get(e['w'], '?') for e in events[-6:])}")
    if gaps:
        print(f"   gap ms  min {min(gaps)}  median {int(statistics.median(gaps))}  max {max(gaps)}")
    if unmatched:
        print(f"   ✗ {len(unmatched)} event(s) name a word that is not on this page")
    if backwards:
        print(f"   ✗ {len(backwards)} event(s) run backwards")
    if len(events) < len(known):
        print(f"   · {len(known) - len(events)} word(s) unmarked")
    # A gap far above the rest is usually a mark that was missed, not a pause.
    if gaps:
        median = statistics.median(gaps)
        suspicious = [i for i, g in enumerate(gaps) if g > max(2500, median * 6)]
        for i in suspicious:
            print(f"   · {gaps[i]} ms after {known.get(events[i]['w'], '?')} — a missed word, or a waqf?")

    return timeline, not (unmatched or backwards)


def snap(page: int, audio: Path, window_ms: int = 120) -> None:
    """Move every mark to the quietest instant within ±window_ms."""
    import torch
    import torchaudio

    timeline = load_json(TIMELINES / f"{page}.json")
    waveform, sr = torchaudio.load(str(audio))
    if waveform.size(0) > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sr, SAMPLE_RATE)

    hop = SAMPLE_RATE // 100  # 10 ms
    frames = waveform.squeeze(0).unfold(0, hop, hop)
    energy = frames.pow(2).mean(dim=1).sqrt()

    events = timeline["events"]
    start = timeline.get("start", 0)
    moved = 0
    for i, event in enumerate(events):
        absolute_ms = start + event["t"]
        centre = absolute_ms // 10
        lo = max(0, centre - window_ms // 10)
        hi = min(energy.size(0) - 1, centre + window_ms // 10)
        if hi <= lo:
            continue
        quietest = int(torch.argmin(energy[lo:hi]).item()) + lo
        candidate = quietest * 10 - start
        # Never let a mark cross its neighbours: a "better" boundary that
        # reorders the words is not better.
        floor = events[i - 1]["t"] + 20 if i else 0
        ceiling = events[i + 1]["t"] - 20 if i + 1 < len(events) else candidate
        candidate = max(floor, min(candidate, ceiling))
        if candidate != event["t"]:
            moved += 1
            event["t"] = candidate

    (TIMELINES / f"{page}.json").write_text(json.dumps(timeline), encoding="utf8")
    print(f"page {page}: snapped {moved}/{len(events)} marks to the nearest quiet moment")


def clip(page: int, audio: Path, first: int, last: int, out: Path) -> None:
    """Export what the timeline claims words `first`..`last` are, to hear it."""
    import torchaudio

    timeline = load_json(TIMELINES / f"{page}.json")
    known = words_of(page)
    events = timeline["events"]
    start = timeline.get("start", 0)
    a = next(e for e in events if e["w"] == first)
    following = [e for e in events if e["t"] > next(x["t"] for x in events if x["w"] == last)]
    end_ms = start + (following[0]["t"] if following else timeline.get("duration", 0))

    waveform, sr = torchaudio.load(str(audio))
    piece = waveform[:, int((start + a["t"]) / 1000 * sr) : int(end_ms / 1000 * sr)]
    torchaudio.save(str(out), piece, sr)
    said = " ".join(known.get(e["w"], "?") for e in events if a["t"] <= e["t"] < end_ms - start)
    print(f"wrote {out} — should be: {said}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pages", type=int, nargs="+", required=True)
    parser.add_argument("--audio", type=Path, help="needed for --snap and --clip")
    parser.add_argument("--snap", action="store_true", help="move marks to the nearest quiet moment")
    parser.add_argument("--window-ms", type=int, default=120)
    parser.add_argument("--clip", type=int, nargs=2, metavar=("FIRST_ID", "LAST_ID"))
    parser.add_argument("--out", type=Path, default=Path("clip.wav"))
    args = parser.parse_args()

    ok = True
    for page in args.pages:
        if args.snap:
            if not args.audio:
                parser.error("--snap needs --audio")
            snap(page, args.audio, args.window_ms)
        _, page_ok = report(page)
        ok = ok and page_ok
        if args.clip:
            if not args.audio:
                parser.error("--clip needs --audio")
            clip(page, args.audio, args.clip[0], args.clip[1], args.out)

    print("\nall clear" if ok else "\nfix the ✗ lines before installing these")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
