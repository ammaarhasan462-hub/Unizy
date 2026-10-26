# Unizy module pack: writing brief

Unizy is a study site for UK university students. Each student picks their university, degree, year and modules. We are writing a **module pack** for each compulsory Year 1 module, so the revision material matches that specific module at that specific university, not just the general subject. Students will rely on this for exams, so **accuracy matters more than volume**.

Work list: `/tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/worklist.json` (each entry: id, uni, code, name, degrees, credits, term, desc, topics, url, L).
Write each pack to: `/tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/packs/<id>.json`
Validate with: `python3 /tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/validate.py <id>` (must print OK).

## Step 1: research the module (required)
1. Fetch the module's official page (`url`) with WebFetch. Also look for the module's page in the university's module catalogue / handbook / syllabus / lecture list if the given page is a programme page (use WebSearch with the code and module name, e.g. "LAWS0001 Contract UCL module"). Prefer official university domains (ucl.ac.uk, imperial.ac.uk, lse.ac.uk, ox.ac.uk, cam.ac.uk, qmul.ac.uk).
2. Establish the module's **actual syllabus**: topics in the order the university teaches them, how it is assessed, and anything distinctive about how this university teaches it (e.g. Cambridge Part IA paper structure, Oxford Prelims, UCL module descriptor). If `topics` in the worklist is non-empty and matches the official page, use it. If the official page gives a fuller or different list, use the official one. If no topic list is published anywhere official, build a sensible topic list from the official description and say so (`topicsSource: "description"`).
3. Never invent facts about the module (assessment weights, lecturers, reading) you couldn't confirm. Only include assessment details you saw on an official page; otherwise leave them out.

## Step 2: decide the pack kind
- `"content"`: a taught academic module (most of them). Full pack.
- `"guide"`: assessment-only, placement, skills, induction, consolidation weeks, student-selected components, labs/projects with no fixed syllabus (e.g. "Applied Knowledge Test Paper 1", "Consolidation, Integration and Feedback Week A", "Student Selected Component", "Lego Mindstorms exercise"). For these write 2–4 notes explaining what it is, how it's assessed (only if confirmed), and how to prepare, plus a few cards/questions only where there is genuine factual content. Do **not** invent a syllabus.

## Step 3: write the pack (British English)
For a `content` pack, for **each topic** (aim for 6–10 topics):
- **1 note**, 350–700 words: clear, exam-focused teaching at first-year undergraduate level for this university. Use short paragraphs and simple "- " lists. Include key definitions, the main arguments/theories/methods, worked examples or formulae where relevant, leading cases/statutes (law), key thinkers and works with dates (humanities/social sciences), standard results (maths/engineering), mechanisms and clinical relevance (medicine). End with a short "Exam tips:" line.
- **6–8 flashcards**: front = term/question (short), back = precise answer (≤ 260 characters). `d` difficulty 1–3.
- **3 questions**: 2 multiple choice (4 options, exactly one correct, plausible distractors, `why` explains the answer and why the others are wrong) and 1 short answer (4–6 marks, `markScheme` of 3–5 points, `modelAnswer`).
Plus **2 long questions** for the module (essay or multi-part problem in the style of this university's exams; 15–25 marks; `markScheme` 5–8 points; `modelAnswer` 250–500 words or a full worked solution).

## Option letters
The app shuffles multiple-choice options, so in `why` never refer to options by letter or position ("option A", "(C)", "the first"). Name them by their content instead, e.g. "Morgenthau's book is classical realism, so it can't be the answer".

## Accuracy rules (critical)
- Only state things that are well established and that you are confident are correct. If in doubt, check with WebSearch, or leave it out.
- Cases: correct name, year and court/citation where you give one; correct ratio. Statutes: correct name, year and section numbers. Never invent a case, statute, study, statistic, quotation or date.
- Maths/engineering/economics: check every formula, derivation step and numerical answer (work it out). Use plain Unicode for maths (x², √, ∫, Σ, ≤, →, θ), no LaTeX.
- Medicine: standard physiology/anatomy/pathology; **no drug doses**.
- Keep it current (UK law and guidance as of 2026). Say "in England and Wales" etc. where jurisdiction matters.
- Write everything in your own words. Don't copy text from university pages or textbooks (short topic titles are fine).

## JSON format (must match exactly)
```json
{
  "id": "M-UCL-LAWS0001",
  "title": "Contract",
  "kind": "content",
  "module": { "uni": "ucl", "code": "LAWS0001", "name": "Contract" },
  "topicsSource": "official",
  "sources": [ { "title": "UCL module page: LAWS0001 Contract", "url": "https://...", "used_for": "syllabus and assessment" } ],
  "about": "2–4 sentences: what this module covers at this university, how it is taught/assessed (only confirmed facts).",
  "topics": ["Formation: offer and acceptance", "..."],
  "notes": [ { "t": 0, "h": "Offer and acceptance", "body": "..." } ],
  "cards": [ { "t": 0, "f": "Invitation to treat", "b": "...", "d": 1 } ],
  "questions": [
    { "t": 0, "type": "mcq", "d": 1, "marks": 1, "q": "...", "options": ["...", "...", "...", "..."], "answer": 2, "why": "..." },
    { "t": 0, "type": "short", "d": 3, "marks": 5, "q": "...", "markScheme": ["...", "..."], "modelAnswer": "..." },
    { "t": 2, "type": "long", "d": 4, "marks": 25, "q": "...", "markScheme": ["...", "..."], "modelAnswer": "..." }
  ]
}
```
`t` is the index into `topics`. Every topic must have a note. Write the file with Python `json.dump(..., ensure_ascii=False, indent=1)` to avoid escaping mistakes, then run the validator and fix anything it reports.

When finished, reply with one line per module: id, kind, number of topics/notes/cards/questions, topicsSource, and any doubts you have about accuracy.
