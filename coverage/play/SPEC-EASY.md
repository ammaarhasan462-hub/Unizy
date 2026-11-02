# Unwind easy questions — writing spec

Unwind is a relaxing daily game on Unizy. Each right answer reveals a letter of a hidden word, so questions must be
EASY: the kind most adults in the UK get right without thinking hard (aim for 85–95% of people knowing it).
Think "warm-up round of a pub quiz", not "final round". Fun and friendly, never tricky.

Good examples of the level:
- What is the capital of France? (Paris)
- How many legs does a spider have? (8)
- Which planet is known as the Red Planet? (Mars)
- What do bees make? (Honey)
- In which sport would you score a try? (Rugby)

Too hard (don't write these): specific dates, people most students haven't heard of, numbers that need exact recall
(e.g. "how many bones in the human body"), obscure etymologies.

## Output
Write a JSON array of exactly 35 objects per category to `/home/claude/unizy/coverage/play/easy-<cat>.json`:

```json
{"id": "geo-101", "cat": "geo", "q": "What is the capital of France?", "options": ["Paris", "Lyon", "Marseille", "Nice"], "answer": 0, "fact": "Paris was known as Lutetia in Roman times.", "diff": 1}
```

- `id`: `<cat>-101` to `<cat>-135`.
- `q`: one short, clear question, max 110 characters. British English.
- `options`: exactly 4 short options (max 40 characters), same type, plausible but clearly wrong. No "all/none of the above".
- `answer`: index 0–3. Spread evenly (about 9 each).
- `fact`: one true, friendly "did you know" sentence, max 150 characters, that doesn't just restate the answer.
- `diff`: always 1.

## Rules
- Only facts that are certainly true and evergreen. No current office-holders, records, rankings by small margins,
  or anything disputed. Exactly one option is right.
- Nothing upsetting: no war, death, disasters, politics or religion-sensitive topics. Never mention AI, Claude or Anthropic.
- Don't duplicate questions already in `/home/claude/unizy/coverage/play/<cat>.json` (check that file).
- Verify any fact sentence you're not completely sure of with web search; if you can't, write a fact you are sure of.

Categories: `geo` Geography, `hist` History, `sci` Science, `nature` Nature & animals, `food` Food & drink,
`sport` Sport & games, `arts` Arts, books & film, `words` Words & language, `space` Space, `uk` London & the UK.

Validate with: `cd /home/claude/unizy/coverage/play && python3 validate.py easy-<cat>.json` and fix until OK
(the validator's answer-position and difficulty summary lines are informational; aim for an even spread).
