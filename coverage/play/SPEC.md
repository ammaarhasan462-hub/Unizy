# Unwind question bank — writing spec

Unwind is a relaxing daily general-knowledge quiz on Unizy (a study site for UK university students). People play it
to wind down after studying, so questions should be fun, interesting and fair, never trick questions.

## Output
One JSON file per category: `/home/claude/unizy/coverage/play/<cat>.json`, a JSON array of exactly 40 objects:

```json
{"id": "geo-001", "cat": "geo", "q": "Which is the longest river in Africa?", "options": ["Congo", "Nile", "Niger", "Zambezi"], "answer": 1, "fact": "The Nile flows through 11 countries before reaching the Mediterranean.", "diff": 1}
```

- `id`: `<cat>-NNN`, numbered 001–040.
- `q`: one clear question, max 140 characters. British English spelling.
- `options`: exactly 4 short options (max 60 characters each), all the same type and plausible. No "all of the above",
  "none of the above", or joke options.
- `answer`: index 0–3 of the correct option. Spread the correct position evenly (about 10 each of 0, 1, 2, 3).
- `fact`: one true, genuinely interesting "did you know" sentence related to the question, max 170 characters. It must not
  just restate the answer.
- `diff`: 1 (most people know), 2 (pub-quiz regular), 3 (tricky but fair). Aim for roughly 14 × 1, 16 × 2, 10 × 3.

## Accuracy rules (most important)
- Only evergreen facts that will not change: no "current" office-holders, records likely to be broken, populations
  ranked by tiny margins, "latest" anything, or prices.
- Exactly one option must be clearly correct; the others must be clearly wrong (no disputed or "depends on definition"
  answers — e.g. avoid tallest/longest claims that are contested, such as Nile vs Amazon length).
- Check every question and every fact against a reliable source with web search if you are not completely certain.
  If something can't be confirmed, drop it and write a different question.
- No song lyrics, poem lines or long quotations. No questions about real living private individuals.
- Avoid politics, religion-sensitive topics, tragedies, violence, and anything that could upset someone. Keep it light.
- Don't repeat the same fact across questions; keep a wide variety of sub-topics within the category.
- Never mention AI, Claude or Anthropic.

## Categories
- `geo` Geography (countries, capitals, rivers, mountains, flags, maps)
- `hist` History (ancient to 20th century, inventions, explorers; light-hearted)
- `sci` Science (physics, chemistry, the human body, everyday science)
- `nature` Nature & animals (animals, plants, oceans, weather)
- `food` Food & drink (dishes, ingredients, origins, around the world)
- `sport` Sport & games (rules, history, classic moments, board games; evergreen only)
- `arts` Arts, books & film (classic novels, paintings, composers, classic films — no lyrics)
- `words` Words & language (word meanings, origins, languages, idioms, spelling)
- `space` Space & astronomy (planets, missions, stars)
- `uk` London & the UK (landmarks, traditions, geography, history, culture)

When finished, validate your files with:
`python3 /home/claude/unizy/coverage/play/validate.py <cat>.json` (run from the play folder) and fix anything it reports.
