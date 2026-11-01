# Unizy

Study website for UK university students: pick your uni, degree and modules, then get notes, flashcards, topic tests, essay marking and an AI tutor built around your course.

## Layout
- `site/`: the website (static files, served by Cloudflare Pages). Build output directory: `site`. No build command.
- `supabase/functions/ai/`: the AI function (Supabase Edge Function) that calls Claude within daily limits.
- `supabase/functions/import-timetable/`: 1-click setup. Reads an uploaded timetable or module handbook (PDF or screenshots) and returns modules, weekly classes, one-off sessions, deadlines/exams and handbook summaries, matched to the uni's module list. Counts as one AI action.
- `supabase/functions/calendar-sync/`: reads a student's uni calendar feed (Moodle, Canvas, Blackboard, timetable iCal/webcal link) server-side and returns its events for the Plan. `ics.ts` is the iCal parser.
- `supabase/functions/verify-uni/`: emails a 6-digit code to a student's uni address (e.g. @ucl.ac.uk) and confirms it. Needs the `RESEND_API_KEY` secret.
- `supabase/sql/campus.sql`: tables and RPCs for uni verification, module hubs, the campus marketplace (plus the public `market` storage bucket for photos) and Study Mode focus rooms.
- `site/assets/campus.js`: the website side of 1-click setup, calendar sync, verification, module hubs, marketplace and Study Mode (shown under Campus and Plan in the app).

## Hosting
- Cloudflare Pages project connected to this repo; every push to `main` redeploys.
- Supabase project `unizy` (London) for accounts, saved work and the AI function. The Anthropic key is stored as the `ANTHROPIC_API_KEY` function secret.

## Home page try box and traffic sources (Nov 2026)
- Home page promise: "Any lecture. Exam-ready in a minute." The try box (`site/assets/try.js`) has two tabs. **Paste your notes**: signed-out visitors get 8 flashcards and 3 practice questions from their own notes via the edge function `supabase/functions/try-cards` (deploy with verify_jwt off; cheap model; 3 goes a day per browser and 60 per network (campus wifi shares IPs), 300 site-wide, inside the daily £ budget; counters in `try_runs`, network = daily-salted hash, no IPs). **Find your module**: real cards and questions from the fact-checked module packs listed in `site/data/try-index.json` (rebuild with `python3 tools/build_try_index.py` after changing packs).
- Cards made in the try box are kept in localStorage `unizy-pending`; the app's Flashcards view offers "Add them" to the open module (saved as the student's own cards).
- Short links for bios, posts and posters (`site/_redirects`): /tiktok /tt /ig /insta /snap /wa /yt /li /reddit /qr /poster /soc /friend → `/?ref=<source>`. The home page counts `src_<source>` (also from the referrer or in-app browser) and the sign-up page counts `join_<source>`; both are anonymous daily totals in `site_events`. `?notrack=1` on any page stops counting on that device (for the owner's own devices).
- Link preview image: `site/assets/og.png` (1200×630).
