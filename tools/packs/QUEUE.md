# Hand-written pack pipeline (no API spend)

The queue lives in the database, not here:
- `pack_gaps` (view): per module, topic count and how many items are still missing against the targets.
- `claim_pack_module()`: locks and returns the next module (Imperial EEE first, then by year of study, then demand).
- `finish_pack_module(code)`: releases the lock and marks the pack done when nothing is missing.

Targets per topic:
- Standard: 5 recall, 2 exam, 1 First (every exam/First with an answer plan, guide and steps).
- Imperial EEE: 6 recall, 3 exam, 2 First.
- Medicine/dentistry (exam_format 'sba'): multiple choice only, 6 SBA + 2 hard SBA.

Written by the scheduled tasks "Unizy pack writing A/B (hourly)"; "Unizy pack progress digest" reports daily (target 1,200 questions a day).
