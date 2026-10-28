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
