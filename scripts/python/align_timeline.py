#!/usr/bin/env python3
"""
Build a page's recitation timeline by forced alignment.

We already know exactly what is being said — the page's words are in
public/annotations/{page}.json — so this is alignment, not transcription. A CTC
acoustic model is asked, for each 20 ms frame, how likely each Arabic letter is;
the alignment then finds the single path through those frames that spells the
known transcript. That is far more accurate than transcribing and matching
afterwards, and it cannot invent a word that was never said.

What it writes is the app's own format, in annotation ids:

    {"page": 553, "audio": "062.mp3", "start": 0, "duration": 259586,
     "events": [{"t": 35, "w": 1}, ...]}

Install (CPU is fine; a page takes a couple of minutes):

    pip install -r scripts/python/requirements.txt

Use — one page, when you know where it starts in the surah recording:

    python scripts/python/align_timeline.py \
        --page 553 --audio ~/audio/062.mp3 --start-ms 0

Several pages sharing one recording, in reading order (recommended: each page
starts where the previous one ended, so no offsets need to be known):

    python scripts/python/align_timeline.py \
        --pages 553 554 555 --audio ~/audio/062.mp3

Then check and install what it wrote:

    python scripts/python/check_timeline.py --pages 553 554 555 --audio ~/audio/062.mp3
    node scripts/import-timeline.mjs public/timeline/553.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import torch
import torchaudio
import torchaudio.functional as F
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

# An Arabic CTC model. Any wav2vec2 model whose vocabulary is Arabic letters
# works; this one is widely used and needs no fine-tuning for our purpose,
# because we are not asking it to recognise anything — only to score letters.
DEFAULT_MODEL = "jonatasgrosman/wav2vec2-large-xlsr-53-arabic"
SAMPLE_RATE = 16_000

REPO = Path(__file__).resolve().parents[2]
ANNOTATIONS = REPO / "public" / "annotations"
TIMELINES = REPO / "public" / "timeline"

# A Windows console defaults to a codepage that cannot encode Arabic, and this
# script reports the words it skipped.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Marks that sit above and below the letters. The model reads letters only, and
# the annotations are inconsistent about vowels, so both sides are stripped to
# the same bare skeleton before they are compared.
TASHKEEL = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def strip_tashkeel(text: str) -> str:
    return TASHKEEL.sub("", unicodedata.normalize("NFC", text))


def to_letters(text: str, vocab: dict[str, int]) -> str:
    """The word as the model's vocabulary can express it."""
    text = strip_tashkeel(text)
    text = (
        text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا")
        .replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    )
    return "".join(c for c in text if c in vocab)


@dataclass
class Word:
    id: int
    text: str
    page: int


def load_words(page: int) -> list[Word]:
    raw = json.loads((ANNOTATIONS / f"{page}.json").read_text(encoding="utf8"))
    words = raw if isinstance(raw, list) else raw.get("words", [])
    out = []
    for w in words:
        # Ayah marks carry no text and are never recited.
        if w.get("id") is None or not str(w.get("text", "")).strip():
            continue
        out.append(Word(id=int(w["id"]), text=str(w["text"]).strip(), page=page))
    if not out:
        raise SystemExit(f"page {page}: no annotated words")
    return out


def load_audio(path: Path) -> torch.Tensor:
    waveform, sr = torchaudio.load(str(path))
    if waveform.size(0) > 1:  # one ear is enough, and the model wants mono
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sr, SAMPLE_RATE)
    return waveform


def align(
    waveform: torch.Tensor,
    words: list[Word],
    model,
    processor,
    device: str,
) -> list[tuple[Word, float, float]]:
    """
    Align a stretch of audio against a known list of words.

    Returns (word, start_seconds, end_seconds) for every word the model could
    express. The whole transcript is forced to span the whole stretch, so the
    stretch passed in must contain these words and little else.
    """
    vocab = processor.tokenizer.get_vocab()

    targets: list[int] = []
    word_of_token: list[int] = []
    spelled: list[int] = []  # indices of words that produced at least one token
    for i, word in enumerate(words):
        letters = to_letters(word.text, vocab)
        if not letters:
            print(f"  ! no usable letters in {word.text!r} (id {word.id}) — skipped")
            continue
        spelled.append(i)
        for c in letters:
            targets.append(vocab[c])
            word_of_token.append(i)

    if not targets:
        raise SystemExit("nothing to align")

    with torch.inference_mode():
        inputs = processor(
            waveform.squeeze(0).numpy(), sampling_rate=SAMPLE_RATE, return_tensors="pt"
        )
        logits = model(inputs.input_values.to(device)).logits
        emission = torch.log_softmax(logits, dim=-1).cpu()

    if emission.size(1) < len(targets):
        raise SystemExit(
            f"the audio is too short for {len(targets)} letters "
            f"({emission.size(1)} frames) — check --start-ms / --end-ms"
        )

    blank = model.config.pad_token_id or 0
    aligned, scores = F.forced_align(
        emission, torch.tensor([targets], dtype=torch.int32), blank=blank
    )
    spans = F.merge_tokens(aligned[0], scores[0].exp())

    # Frames back to seconds: the model consumes the waveform at a fixed stride.
    seconds_per_frame = waveform.size(1) / emission.size(1) / SAMPLE_RATE

    bounds: dict[int, list[float]] = {}
    for token_index, span in enumerate(spans):
        i = word_of_token[token_index]
        start, end = span.start * seconds_per_frame, span.end * seconds_per_frame
        if i in bounds:
            bounds[i][1] = end
        else:
            bounds[i] = [start, end]

    return [(words[i], bounds[i][0], bounds[i][1]) for i in spelled if i in bounds]


def write_timeline(page: int, audio_name: str, marks: list[tuple[Word, float, float]], end_s: float) -> Path:
    start_ms = int(round(marks[0][1] * 1000))
    events = [{"t": max(0, int(round(s * 1000)) - start_ms), "w": w.id} for w, s, _ in marks]
    out = {
        "page": page,
        "audio": audio_name,
        "start": start_ms,
        # The last word ends where the page does, so this closes its span.
        "duration": max(0, int(round(end_s * 1000)) - start_ms),
        "events": events,
    }
    TIMELINES.mkdir(parents=True, exist_ok=True)
    path = TIMELINES / f"{page}.json"
    path.write_text(json.dumps(out), encoding="utf8")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--page", type=int, help="a single page")
    parser.add_argument("--pages", type=int, nargs="+", help="pages sharing one recording, in reading order")
    parser.add_argument("--audio", required=True, type=Path, help="the surah mp3")
    parser.add_argument("--start-ms", type=int, default=0, help="where the first page begins in it")
    parser.add_argument("--end-ms", type=int, default=None, help="where the last page ends")
    parser.add_argument("--pad-s", type=float, default=20.0, help="slack around each page's estimated window")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    pages = args.pages or ([args.page] if args.page else [])
    if not pages:
        parser.error("give --page or --pages")

    print(f"loading {args.model} on {args.device} …")
    processor = Wav2Vec2Processor.from_pretrained(args.model)
    model = Wav2Vec2ForCTC.from_pretrained(args.model).to(args.device).eval()

    waveform = load_audio(args.audio)
    total_s = waveform.size(1) / SAMPLE_RATE
    print(f"{args.audio.name}: {total_s:.1f}s")

    cursor_s = args.start_ms / 1000
    hard_end_s = (args.end_ms / 1000) if args.end_ms else total_s

    for page in pages:
        words = load_words(page)
        # A window big enough for the page and no bigger: forcing the whole
        # transcript across the whole recording would stretch it over material
        # from other pages, and the memory cost grows with the window.
        estimate_s = len(words) * 1.2
        window_start = max(0.0, cursor_s - 1.0)
        window_end = min(hard_end_s, cursor_s + estimate_s + args.pad_s)
        if window_end - window_start < 1.0:
            print(f"page {page}: no audio left")
            break

        print(f"page {page}: {len(words)} words, aligning {window_start:.1f}s–{window_end:.1f}s …")
        segment = waveform[:, int(window_start * SAMPLE_RATE) : int(window_end * SAMPLE_RATE)]
        marks = align(segment, words, model, processor, args.device)
        marks = [(w, s + window_start, e + window_start) for w, s, e in marks]

        last_end = marks[-1][2]
        if window_end - last_end < 1.0 and window_end < hard_end_s:
            print("  ! the page ran to the edge of its window — raise --pad-s and redo it")

        path = write_timeline(page, args.audio.name, marks, last_end)
        print(f"  wrote {path.relative_to(REPO)} — {len(marks)}/{len(words)} words, "
              f"{marks[0][1]:.1f}s→{last_end:.1f}s")
        cursor_s = last_end

    print("\nnow check them, then install:")
    print(f"  python scripts/python/check_timeline.py --pages {' '.join(map(str, pages))} --audio {args.audio}")
    print(f"  node scripts/import-timeline.mjs public/timeline/{pages[0]}.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
