# Medical pack (med2) check: addendum to CHECK.md

Read CHECK.md first and do everything it says. Then read SPEC-MED.md (the med2 format). Medical packs are held to a stricter standard because students will apply this on wards. The pack is in `coverage/packs_med/<id>.json`; write your report to `coverage/checks_med/<id>.json`. The validator accepts a path: `python3 coverage/validate.py coverage/packs_med/<id>.json`.

Check, in addition to CHECK.md:
1. **Sections.** Every section's `body` is correct and sits under the right `k`. `kind` is honest: anything a guideline body could change (treatment choices, thresholds, screening intervals, referral criteria, targets) is `guidance`, not `principle`.
2. **Guidance.** Open every guidance source on the official site (NICE, SIGN, BTS, Resuscitation Council UK, UKHSA, GMC…). Confirm the claim matches the current version, the guideline number and title are right, and `asOf` is the month you checked it. Look up whether it has been updated or withdrawn.
3. **No doses.** No drug doses, frequencies or regimens anywhere (notes, cards, explanations, cases). Drug classes and mechanisms are fine.
4. **Every explanation.** For each MCQ: `optWhy` has one entry per option, each says something true and specific about that option (not "this is wrong"), and the entry for the right answer agrees with `why`. `clue` really is in the stem. `concept` is what's tested. `sec` points to the note section that teaches it. The `followUp` has exactly one correct option, its `answer` is right, and it tests the same concept in a different scenario.
5. **Interpretation.** Recompute every bloods/ABG reading. ABG: check pH, PaCO2 and HCO3 are internally consistent (Henderson–Hasselbalch roughly holds), and that the answer's acid–base label is right. Reference ranges are labelled typical adult UK ranges that vary by lab. ECGs: the numbers (`rhythm`, `rate`, `pr`, `qrs`, `qt`) must be physiologically consistent with the correct answer (e.g. first-degree block needs pr > 0.20 s; complete heart block a slow ventricular rate; broad complex needs qrs ≥ 0.12 s).
6. **Cases and OSCE.** Case steps are realistic and their `ask` answers are right; the debrief points are true. OSCE steps match standard UK teaching and are in a sensible order; the cited source exists and supports them; no copied text.
7. **Labels.** Items use only the allowed heart keys and match what the topic teaches.
8. **Cards.** At most 2 recall cards per topic; `ex` is correct; `q` (if present) points to a question on the same concept.
9. **Never claim clinician review** anywhere in the pack.

Report format as CHECK.md, plus `"guidance_checked": [{"where": "...", "source": "url", "asOf": "YYYY-MM", "status": "current|updated|withdrawn"}]`.
