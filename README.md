# 🃏 Card Night Champions

A colourful, 8-bit themed scoreboard for card-game nights: UNO, Poker, Big Two, Blackjack, or anything else you play.
Record who played and who won, and the dashboard works out the champion, win rates, streaks and the best player for each game.

**Live site:** https://liyohhh.github.io/CardDashboard/

![Dashboard](docs/preview.png)

## Features

- **Champion card and top 3:** the current leader, the runners-up and who is on a winning streak.
- **Win rates and stats:** wins, games played, win rate, longest streak and last-5 form for every player.
- **Per-game view:** tap a game tab (e.g. *Poker*) to see the rankings for that game only.
- **Champion of each game,** plus star ratings for the overall champion in every game.
- **Match history:** grouped by date, with filters for game, player and date range; edit or delete any match.
- **Quick match entry:** pick a game (or create a new one on the spot), set the date, tap who played and who won.
- **Custom players:** each player gets a coloured profile head with their own colour and face.
- **Shared and live:** scores are stored in Supabase, so everyone sees the same data on any device and changes appear instantly.
- **Change log:** every add, edit and delete is recorded with the person's name and time. Only the owner can read it.
- **Daily backups:** a snapshot of all data is saved every day and kept for 30 days.
- **Animated 8-bit header,** pixel fonts and colourful flat icons. Works on phones, tablets and laptops.

![Welcome screen](docs/welcome.png)

## How it works

It's a plain static website (HTML, CSS and JavaScript, no build step) hosted on GitHub Pages, with
[Supabase](https://supabase.com) as the database.

| File | What it is |
|---|---|
| `index.html`, `style.css` | Page layout and styles |
| `app.js` | Dashboard logic: stats, history, players, games, syncing |
| `header.js` | The animated 8-bit header |
| `welcome-art.js` | The pixel landscape on the welcome screen (used when `welcome.jpg` is missing) |
| `effects.js`, `vendor/` | Visual effects from canvas-ui: tap ripples, header glitch and dither |
| `icons.js` | Icon set |
| `config.js` | Which Supabase project the site uses |
| `supabase-setup.sql` | Database tables, access rules, change log and backups |

Add `?demo` to the address to see the dashboard with sample data without touching the real database.

## Access and safety

Anyone who opens the site can view and edit the scores. People type their name once, and it's shown in the change log.
The Supabase key in `config.js` is a *publishable* key, which is meant to be public. What visitors can do is controlled
by the database's Row Level Security rules in `supabase-setup.sql`. The change log and backups can only be read by the owner account.

## Run your own copy

1. **Fork** this repository (or download it).
2. **Supabase:** create a free project, open **SQL Editor → New query**, paste all of `supabase-setup.sql` and run it.
3. **Owner account:** in **Authentication → Users → Add user**, create a user for yourself, then run:
   ```sql
   insert into public.app_owner (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```
   Recommended: turn off **Allow new users to sign up** under **Authentication → Sign In / Providers**.
4. **Config:** put your **Project URL** and **publishable key** (Project Settings → API Keys) in `config.js`.
   If you'd rather keep the site private, leave both values empty. Visitors then see a private screen, and you share
   access with an invite link from **Manage → Sharing & sync**.
5. **GitHub Pages:** in your repository, **Settings → Pages → Deploy from a branch → `main` / root → Save**.
6. Optional: add a `welcome.jpg` to use your own picture on the welcome screen.

## Credits

- Visual effects: [canvas-ui](https://github.com/DavidHDev/canvas-ui) by David Haz (MIT + Commons Clause). The bundled copy in
  `vendor/` is modified so the dither and glitch effects can read the header canvas; see `vendor/canvas-ui-LICENSE.md`.
- Icons: [Streamline](https://www.streamlinehq.com) "Core" flat icons (CC BY 4.0), recoloured.
- Fonts: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)
  and [Nunito](https://fonts.google.com/specimen/Nunito) (SIL Open Font License).
- Pixel art (header, welcome landscape, playing cards) and profile heads were made for this project.
