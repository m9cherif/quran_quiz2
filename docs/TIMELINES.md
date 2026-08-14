# Recitation timelines

A timeline answers one question: **at which millisecond does each word of a page
start being recited?** Everything the platform does with audio is built on that
one file — following words during playback, stopping at a covered word in
"recite & fill", isolating an ayah for dictation, cutting a clip for a generated
audio question, and reciting from one chosen word to another.

There is no audio analysis anywhere. A word ends where the next one begins, so
start times alone give exact spans (`wordSpans` in
[`src/lib/quran/recitation.ts`](../src/lib/quran/recitation.ts)).

## The file

`public/timeline/{page}.json`:

```json
{
  "page": 553,
  "audio": "062.mp3",
  "start": 0,
  "duration": 259586,
  "events": [{ "t": 35, "w": 1 }, { "t": 7407, "w": 2 }]
}
```

| field      | meaning                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `audio`    | file name inside the upstream `audio/` folder — the mp3 is **not** committed, it streams from raw GitHub |
| `start`    | where this page begins inside that mp3 (ms) — pages share a surah recording |
| `duration` | length of the recording (ms); it closes the last word's span             |
| `events[].t` | ms **from `start`**, not from the beginning of the mp3                 |
| `events[].w` | the word's **annotation id**, matching `public/annotations/{page}.json` |

`public/timeline/index.json` lists every page that has one: `{ audio, words,
duration }`. The practice page uses it to decide which pages to offer, so a page
missing from the index is invisible even if its file exists.

### The one trap: ids are not ordinals

The upstream files in `flutter_quran_data/timeline` number their events by the
word's **rank on the page** — 1, 2, 3 — while page boxes are keyed by the
annotation **id**. These are not the same number, because annotation ids also
count the ayah-end marks, which are never recited. Page 553 skips six ids, so
reading an ordinal as an id put the highlight one word out at the first ayah
mark and six words out by the bottom of the page, and the last six words matched
nothing at all.

`scripts/fetch-timelines.mjs` converts ordinal → id at import. **What ships in
`public/timeline` is always annotation ids.** Anything you author by hand must
be too.

## Building a timeline

### Option A — import the upstream files (all 17 pages at once)

```bash
node scripts/fetch-timelines.mjs
```

Fetches every `timeline/pageNNN.json` from the data repo, converts the word
ordinals to annotation ids, and rewrites `public/timeline/` plus its index. It
warns about events that fall outside the annotated words instead of writing them
silently. Run it whenever the upstream repo gains pages — it needs
`public/annotations/{page}.json` to exist first, so run
`node scripts/fetch-annotations.mjs` before it for a new page.

### Option B — author one by tapping along (`/host/timeline`)

Best when you want a page done now, with no setup: it needs nothing but a
browser and an ear. For a whole surah, or for boundaries tighter than a hand
can tap, use option C.

For a page with no recording upstream, or one whose marks are wrong or stop
early (554, 587, 588, 600 and 604 are only partly marked), sign in as a host and
open **Timeline builder** in the header.

1. **Pick the page.** Its annotations load, and if a timeline already exists its
   audio file name and offsets are filled in for you.
2. **Set the audio file** — the name inside the upstream `audio/` folder, e.g.
   `062.mp3` (one file per surah). It streams; nothing is downloaded into the
   repo.
3. **Set "page starts at"** if the page does not begin at the start of that mp3.
   Everything you mark is stored relative to it.
4. **Slow it down** to 0.5× or 0.75×. Accuracy matters far more than time here,
   and the marks stay correct at any playback rate.
5. **Play and tap.** The next word to mark is shown large, with the following
   five after it, and outlined in amber on the page image. Press **Space** the
   instant the reciter reaches it. Marked words fill green on the page, so you
   can see at a glance where you are.
   - **P** — play/pause
   - **Backspace** — undo the last mark (and step back one word)
   - **←** / **→** — nudge the last mark by 50 ms
6. **Watch the warnings** under the controls: marks that run backwards in time,
   words still unmarked, a missing file name.
7. **Download `{page}.json`** when the page is done.

Then install it:

```bash
node scripts/import-timeline.mjs ~/Downloads/553.json
```

The script refuses a file whose events name words that are not on that page or
whose marks run backwards — a wrong timeline is worse than none, because every
drill downstream trusts it silently. Pass `--force` to override. It keeps the
previous file as `{page}.json.bak` and updates `index.json`.

Commit `public/timeline/{page}.json` and `public/timeline/index.json`.

### Option C — forced alignment in Python (the precise one)

Tapping is accurate to how steady your hand is; alignment is accurate to about
a frame. Use this when you want a whole surah timed properly, or a page timed
better than a human can tap it.

It is **alignment, not transcription**: the words are already known, so a CTC
acoustic model is asked how likely each Arabic letter is in every 20 ms frame,
and the path through those frames that spells the known page is the answer.
Nothing can be invented — the model is never allowed to choose the words.

```bash
pip install -r scripts/python/requirements.txt
```

```bash
python scripts/python/align_timeline.py --pages 553 554 555 --audio ~/audio/062.mp3
```

Pass every page that shares one recording, **in reading order**. Each page is
aligned in a window that opens where the previous page ended, so no offsets
need to be known and the memory cost stays flat — forcing a whole surah in one
pass would stretch one page's words over another's audio. `--start-ms` says
where the first page begins if the recording opens with something else (an
isti'adha, a basmala); `--pad-s` widens the window if a page is reported as
having run to its edge.

CPU is enough — a page takes a couple of minutes; the first run downloads the
model (~1 GB).

Then check what it produced, and sharpen it if you like:

```bash
python scripts/python/check_timeline.py --pages 553 554 555 --audio ~/audio/062.mp3
```

The checker reports coverage, marks that run backwards, events naming words
that are not on the page, and — usefully — gaps far larger than that page's
median, which are either a genuine waqf or a word the alignment lost. It prints
the first and last words each timeline claims, which is the fastest way to see
that a page is off.

`--snap` moves every mark to the quietest instant within ±120 ms. A reciter
leaves a dip in energy between words, while the aligner marks where the next
letter becomes likely — usually a few tens of milliseconds late. Snapping puts
the boundary in the gap, where the ear expects it, and never lets a mark cross
its neighbours.

`--clip FIRST_ID LAST_ID --out sample.wav` exports what the timeline *claims*
two words span, and prints what should be heard. If those disagree, the
timeline is wrong — this is the only test that cannot lie to you.

### Option D — a draft from the mp3, corrected in Excel (semi-automatic)

No model, no download: the mp3, the annotation workbook, and a review
spreadsheet. `pip install -r scripts/python/requirements-semiauto.txt` (numpy,
soundfile, openpyxl — soundfile's wheel decodes mp3 by itself, so no ffmpeg).

```bash
python scripts/python/propose_timeline.py \
    --page 553 --audio ~/audio/062.mp3 --start-ms 6300 --end-ms 178500 \
    --out review_553.xlsx
```

Words come from `public/annotations/{page}.json`, or straight from the data
repo's workbook with `--xlsx-words a553.xlsx`. Open the sheet, listen, and type
a corrected millisecond in the **fixed_ms** column for any row that is off —
empty cells keep the proposal. Then:

```bash
python scripts/python/xlsx_to_timeline.py --xlsx review_553.xlsx
```

**What it is worth, measured.** Against the hand-made timeline for page 553
(`--compare public/timeline/553.json` prints this for any page):

| | error |
| --- | --- |
| ayah boundaries | 73–412 ms |
| every word | median 1.1 s, p90 2.4 s, 34/118 within half a second |

So the ayah rows are right and the word rows are a draft. That is not a tuning
failure, it is the method's ceiling: page 553 has about 300 energy onsets for
118 words, and nothing in the loudness of a recording says which of them start
a word rather than a syllable. What the draft does buy you is that the page is
already in order, already split at every pause, and — because each ayah start is
pinned to the reciter's long silence — a mistake can never travel past the end
of its ayah.

Use it when you want to correct a page rather than build one from nothing, or
when you need ayah times (dictation, ayah clips) and nothing finer. For
word-level precision without a human in the loop, use option C.

## A page that straddles two surahs

Page 554 is the last three ayat of al-Jumu'a and the first four of
al-Munafiqun, and the two surahs are recorded separately — so one page needs
`062.mp3` **and** `063.mp3`. That is why it had only 61 of its 119 words timed:
the format held one recording per page, so the second half could not be
expressed at all.

A timeline may now carry `parts`:

```json
{
  "page": 554,
  "audio": "062.mp3", "start": 0, "duration": 259586, "events": [...],
  "parts": [
    { "audio": "062.mp3", "start": 0,    "duration": 259586, "events": [...] },
    { "audio": "063.mp3", "start": 6050, "duration": 97050,  "events": [...] }
  ]
}
```

The first part is repeated in the plain fields, so anything reading only those
still gets a working timeline for the start of the page rather than nothing.
`timelineParts`, `partOfWord` and `locateWord` in
[`recitation.ts`](../src/lib/quran/recitation.ts) hide the difference; "follow
along" plays straight through from one recording into the next, dictation takes
each ayah from the file it was recited in, and a range that would cross the two
is refused rather than half played.

**Both builders take a plan**, which is how a page gets built from two files —
and `keep` protects work already done by ear:

```json
[
  { "page": 554, "keep": true },
  { "page": 554, "audio": "063.mp3", "words": "57:", "start_ms": 5000, "end_ms": 103100 }
]
```

```bash
python scripts/python/propose_timeline.py --plan plan.json   # energy, runs anywhere
python scripts/python/align_timeline.py   --plan plan.json   # forced alignment
```

`words` is a slice of the page's words in reading order (`"0:57"`, `"57:"`),
and `start_ms`/`end_ms` bound the stretch of recording to look in. Entries are
taken in order; without `start_ms` each one begins where the previous entry in
that same recording ended.

### Practical notes

- **You do not have to finish a page in one pass.** A partial timeline is valid:
  drills simply use the words that are marked. Mark what you are sure of.
- **Repeats are fine.** If the reciter repeats a phrase, mark it each time — the
  same word may appear in several events. The range player takes the first time
  the opening word is said and the first closing word after it, so a repeat
  never produces a backwards range.
- **Mark the start of a word, not its end.** A late mark makes the highlight lag
  and cuts the previous word short; when in doubt, mark slightly early.
- **Check your work** in `/practice`: "Follow along" shows the drift immediately,
  and "Recite from … to …" is the strictest test — pick two words and listen to
  whether the boundaries land exactly on them.

## Checking every page at once

```bash
node -e "
const idx=require('./public/timeline/index.json');
for(const p of Object.keys(idx)){
  const t=require('./public/timeline/'+p+'.json');
  const a=require('./public/annotations/'+p+'.json');
  const words=(Array.isArray(a)?a:a.words||[]);
  const byId=new Map(words.map(w=>[w.id,w.text]));
  const bad=t.events.filter(e=>!byId.has(e.w)).length;
  console.log(p,'events',t.events.length,'of',words.length,'words · unmatched',bad);
  console.log('   ',t.events.slice(0,6).map(e=>byId.get(e.w)).join(' '));
}"
```

`unmatched` must be 0 on every page, and the sample line must read as the actual
opening words of that page. That check is what caught the ordinal/id bug.
