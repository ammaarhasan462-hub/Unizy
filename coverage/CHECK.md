# Unizy module pack: independent fact-check brief

You are the **independent checker**. Someone else wrote these packs; assume nothing is right until you have checked it. Students will revise from this for real exams, so every error you miss could cost them marks.

Packs: `/tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/packs/<id>.json`
Writing brief (format and rules): `/tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/SPEC.md`
Validator: `python3 /tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/validate.py <id>`

For each pack:
1. **Syllabus**: open the official module page(s) in `sources` (WebFetch) and confirm the topic list and order really match this module at this university, and that `about` contains only facts the official page supports. Fix or remove anything unsupported (e.g. assessment weights you can't confirm).
2. **Every note, card and question**: check each factual claim. Use your own knowledge and WebSearch/WebFetch whenever you are not certain: case names, years, citations and ratios; statute names and section numbers; dates; who said/wrote what; formulae, derivations and numerical answers (recompute them); physiological values and mechanisms; definitions. Check that MCQs have exactly one correct option, that `answer` points to it, and that the distractors are actually wrong. Check mark schemes and model answers are correct and consistent with the question.
3. **Fix** errors directly in the JSON (edit with Python, keep the format). If a claim can't be verified, rewrite it to what you can verify or remove it. Don't pad the pack; correct it.
4. In MCQ `why` texts, options must be named by content, never by letter or position (the app shuffles options). Rewrite any that use letters.
5. Check the writing: British English, clear, in the writer's own words (no copied paragraphs), no LaTeX, no drug doses, nothing invented.
6. Run the validator until it prints OK.
7. Write a check report to `/tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage/checks/<id>.json`:
```json
{ "id": "...", "checked_at": "2026-10-26", "syllabus_confirmed": true, "syllabus_note": "matches official page / differences fixed / no official topic list (built from description)",
  "items_checked": 123, "fixes": [ { "where": "notes[2]", "problem": "...", "fix": "...", "source": "url or reference" } ],
  "removed_unverifiable": ["..."], "verdict": "pass" }
```
Use `"verdict": "fail"` only if the pack is not usable after your fixes (e.g. wrong module entirely), and explain why.

Reply with one line per pack: id, verdict, number of fixes, and the most serious problem you found.
