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
