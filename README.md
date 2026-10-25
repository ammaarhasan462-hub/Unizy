# Unizy

Study website for UK university students: pick your uni, degree and modules, then get notes, flashcards, topic tests, essay marking and an AI tutor built around your course.

## Layout
- `site/`: the website (static files, served by Cloudflare Pages). Build output directory: `site`. No build command.
- `supabase/functions/ai/`: the AI function (Supabase Edge Function) that calls Claude within daily limits.

## Hosting
- Cloudflare Pages project connected to this repo; every push to `main` redeploys.
- Supabase project `unizy` (London) for accounts, saved work and the AI function. The Anthropic key is stored as the `ANTHROPIC_API_KEY` function secret.
