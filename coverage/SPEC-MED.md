# Unizy medical pack format (v2): writing brief

Read SPEC.md first: every rule there still applies (accuracy, sources, no lecturer names, no internal worklist, option letters, current figures, British English, no LaTeX, write with Python json.dump, validator must print OK). This file adds the extra structure medical packs need. Validate with `python3 /tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/validate.py <id>` (it checks the v2 fields when `"format": "med2"` is set).

Medical students must learn a lot AND apply it safely. Every topic follows one pathway: **Understand → Retrieve → Apply → Improve**. No drug doses anywhere. Educational content only, never individual clinical advice.

## Top-level additions
```json
{ "format": "med2", "reviewed": "2026-10-27", ... all SPEC.md keys ...,
  "cases": [...], "osce": [...], "interpret": [...], "labels": [...] }
```

## Notes: one per topic, with sections
Keep `t`, `h`, and `body` (body = the sections joined as plain text, used by the AI tutor; build it from the sections). Add:
```json
{ "t": 0, "h": "Cardiac cycle", "overview": "2–3 sentence quick overview a student reads first.",
  "objectives": ["Explain why ...", "Interpret ...", "Distinguish ..."],
  "sections": [
    { "k": "core", "h": "Core concept", "body": "...", "kind": "principle", "src": [0] },
    { "k": "mechanism", "h": "Mechanism", "body": "...", "kind": "principle", "src": [0, 2] },
    { "k": "features", "h": "Key features", "body": "symptoms, signs, important distinctions", "kind": "principle", "src": [1] },
    { "k": "investigations", "h": "Investigations", "body": "what each test measures and how to interpret findings", "kind": "principle", "src": [1] },
    { "k": "management", "h": "Management principles", "body": "high-level educational principles only, no doses", "kind": "guidance", "asOf": "2026-10", "src": [3] },
    { "k": "clinical", "h": "Clinical application", "body": "a short case showing how the concepts connect", "kind": "principle", "src": [1] },
    { "k": "misconceptions", "h": "Common misconceptions", "body": "- Students often think X. In fact Y, because Z.", "kind": "principle", "src": [1] }
  ] }
```
- `k` must be one of: core, mechanism, features, investigations, management, clinical, misconceptions. Use all seven where they make sense; for pure basic-science topics (e.g. cell biology) `features`, `investigations` and `management` may be omitted, but `core`, `mechanism`, `clinical`, `misconceptions` are required.
- `objectives`: 3–6 "should be able to …" statements (explain / interpret / distinguish / apply).
- `kind`: `"principle"` = stable science; `"guidance"` = a clinical recommendation that can change (NICE, BTS, UKHSA, GMC, Resus Council …). Every `guidance` section must have `asOf` (YYYY-MM) and cite the guideline in `src` (indices into the pack's `sources`, each with a real URL). Check every guidance point online on the official site.
- Overview ≤ 60 words; each section 60–250 words; the whole note 450–1000 words.

## Flashcards: test understanding
Each card adds `kind`, `sec`, `ex`:
```json
{ "t": 0, "kind": "why", "f": "Why does aortic stenosis cause an ejection systolic murmur?", "b": "...", "sec": "mechanism", "ex": "One-line explanation shown if the student gets it wrong.", "q": 12, "d": 2 }
```
- `kind` ∈ recall, mechanism, why (why a symptom/sign occurs), distinguish (two similar things), interpret (a finding), apply (short scenario). Per topic aim for at most 2 recall cards; the rest must be the other kinds. No trivial isolated-fact cards.
- `sec` = the note section the card comes from. `q` (optional) = index of a related practice question in `questions`.

## Questions: every answer explained
MCQs add:
```json
{ "t": 0, "type": "mcq", "stage": "apply", "q": "A 68-year-old ... What is the most likely ...?",
  "options": ["...","...","...","..."], "answer": 2,
  "why": "Why the correct answer is right (2–4 sentences).",
  "optWhy": ["why option 0 is wrong (or right)", "...", "...", "..."],
  "clue": "The key clue in the stem, quoted or paraphrased.",
  "concept": "The underlying concept being tested (one line).",
  "sec": "investigations",
  "followUp": { "q": "Same concept, different scenario ...", "options": ["...","...","...","..."], "answer": 1, "why": "..." } }
```
- `stage`: `"retrieve"` (recall without notes: direct question) or `"apply"` (clinical vignette, data or image interpretation). Per topic at least 1 retrieve and 2 apply MCQs.
- `optWhy` has one entry per option; the entry for the correct option restates briefly why it's right. Name options by content, never by letter or position.
- `followUp` tests the same concept in a different scenario; its own `why` explains it. Spread correct answers across positions in both.
- Short/long questions keep `markScheme` and `modelAnswer`, and add `sec` and `concept`.

## Clinical case walkthroughs (`cases`, 1–3 per pack)
```json
{ "t": 0, "title": "Breathless on exertion", "steps": [
   { "text": "Presentation ...", "ask": { "q": "What do you want to know next?", "options": [...], "answer": 1, "why": "..." } },
   { "text": "Examination findings ...", "ask": {...} },
   { "text": "Investigations ...", "ask": {...} },
   { "text": "Outcome and key learning ...", "ask": null } ],
  "debrief": ["Key learning point", "..."] }
```
Realistic, educational, no doses, no real patients.

## OSCE checklists (`osce`, 0–3 per pack, where the module teaches clinical skills)
```json
{ "t": 2, "title": "Cardiovascular examination", "steps": ["Wash hands, introduce yourself, confirm identity, gain consent", "..."], "tips": ["..."], "src": [4] }
```
Base on standard UK teaching (cite a source, e.g. a medical school or Geeky Medics page, as `src`); don't copy text.

## Interpretation practice (`interpret`)
```json
{ "t": 1, "kind": "bloods", "title": "...", "rows": [["Haemoglobin", "98", "g/L", "130–180"], ...], "q": "...", "options": [...], "answer": 0, "why": "...", "optWhy": [...] }
{ "t": 3, "kind": "ecg", "title": "...", "ecg": { "rhythm": "sinus", "rate": 75, "pr": 0.16, "qrs": 0.08, "qt": 0.38 }, "q": "...", "options": [...], "answer": 1, "why": "...", "optWhy": [...] }
{ "t": 4, "kind": "abg", "title": "...", "rows": [["pH", "7.31", "", "7.35–7.45"], ...], "q": "...", ... }
```
- ECG `rhythm` ∈ sinus, af, flutter, chb (complete heart block), first_degree (set pr > 0.20); `rate` in bpm; intervals in seconds. The app draws a lead II strip on standard paper (25 mm/s, small square 0.04 s) from these numbers, so the numbers must be physiologically consistent with the answer.
- Reference ranges must be labelled as typical adult UK ranges that vary by lab.

## Label-the-diagram (`labels`)
Only use diagram ids the app can draw: `"heart"` (four-chamber schematic). Items are the structure keys to identify:
```json
{ "t": 0, "diagram": "heart", "items": ["ra", "rv", "la", "lv", "tricuspid", "mitral", "pulmonary", "aortic", "septum"] }
```

## Accuracy (stricter than SPEC.md)
- Prefer recognised textbooks, official curricula and current UK guidance (NICE, SIGN, BTS, Resuscitation Council UK, UKHSA, GMC). Look up every guidance point online.
- Mark contested science as contested. Values are typical and labelled approximate.
- Never claim clinician review.

## Checkers keep finding (pilot lessons)
- Thresholds and cut-offs a guideline sets (EF bands, BP stages, postural-drop criteria, saturation targets, spirometry ratios) are `guidance`, not `principle`, even if they look like plain facts.
- Cite the guideline itself (NICE/ESC/BTS document), not a secondary summary. Check the guideline's "update information" page for the latest update date and say it correctly.
- State the important exceptions in a recommendation (e.g. NG245: highly symptomatic or severe exacerbation at diagnosis starts on MART), not just the main pathway.
- Every source must actually say what it is cited for in its visible text. Don't cite a page because a search snippet or page keyword matched.
- Avoid absolute words ("only", "always", "earliest") unless the source says exactly that.
