# Dragon Hunt · Baccarat LED

A side-game display for ETG Baccarat tables (BC1 & BC2) at Vegas Club.
When Banker or Player wins **6 hands in a row** it's a **dragon**: guests who followed it win a prize that climbs each hand up to King Dragon (10), and guests who break a long dragon win a slayer prize.

The app has two screens:

- **Dealer Control** (tablet): seat guests and enter MB#, tap each hand's result, pick the qualifying seats when a dragon lands, export the session to Excel.
- **LED wall** (1920×1080): a 16:9 window for the table system's own screen, the current streak as a gold dragon that lights up hand by hand, the Top Hunters ranking, and full-screen 3D gold dragon moments.

Plain HTML, CSS and JavaScript. No build step, no framework.

## Run it

```bash
git clone <this repo>
cd dragon-hunt
python3 -m http.server 8080
# open http://localhost:8080
```

Use a web server rather than opening `index.html` from disk, otherwise browsers may block the videos.

### GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`. The page is served at `https://<user>.github.io/<repo>/`.

## Screens (URL hash)

| URL | Device | Shows |
|---|---|---|
| `/` | Desktop | Demo: Dealer Control and LED preview side by side, with an auto demo |
| `/#host-bc1`, `/#host-bc2` | Dealer tablet | Dealer Control for one table |
| `/#display-bc1`, `/#display-bc2` | LED PC | Full-screen LED for one table (tap once to start sound and full screen) |

> Host ↔ display sync was built on claude.ai's shared database. Outside claude.ai the `#host` / `#display` links show "Cannot sync" and the page works in demo mode only. See [Sync](#sync).

## Project layout

```
index.html          Markup for Dealer Control and the LED stage
css/style.css       All styles (LED is a fixed 1920×1080 stage scaled to the screen)
js/dragon-kit.js    Procedural dragon (papercut / classic styles), used for coded effects
js/app.js           Game logic, rendering, overlays, export, sync
assets/             Gold dragon still, sample system-screen image
media/              3D gold dragon clips: .webm (VP9 + alpha) and .mp4 (on black, Safari fallback)
```

## LED layout

- **System screen window:** x 48, y 28, 1200 × 675 px of the 1920 × 1080 output. It's pure green `#00FF00` (key) or black; composite the table system's HDMI feed there in the video switcher or OBS. "Sample image" shows `assets/system-screen-sample.jpg` for previews.
- **Streak:** BANKER / PLAYER ×N and the gold dragon, one section per win, prizes under 6–10.
- **Top Hunters:** session ranking by MB# across both tables (only the last 4 digits are shown).
- **Overlays:**

| Event | Clip | Length |
|---|---|---|
| Dragon Alert (4) / One More (5) | `media/dragon-1` | 4.4 s |
| Dragon 6–7 | `media/dragon-4` | 5.8 s |
| Dragon 8–9 | `media/dragon-3` | 6.0 s |
| King Dragon (10) | `media/dragon-2` | 8.0 s |
| Dragon Slain | coded effect (slash, dragon splits and falls) | 5.6 s |

Chrome and Edge play the transparent WebM. Safari has no VP9 alpha, so it plays the MP4 on black with `mix-blend-mode: screen`.

## Game rules (in `js/app.js`)

- A Tie never breaks a streak.
- Streak 4 → Dragon Alert, 5 → One More, 6–10 → follow prize per selected seat, above 10 → no prize.
- A broken dragon of 6+ shows Dragon Slain; the slayer prize applies only from the plan's threshold.
- Prize plans (`SCHEMES`):

| Plan | 6 | 7 | 8 | 9 | 10 | Slay |
|---|---|---|---|---|---|---|
| `AB` (default) | $68 | $68 | $88 | $138 | $288 | $68 from 8 |
| `A` | $68 | $88 | $138 | $188 | $288 | $68 from 8 |
| `CUR` | $68 | $88 | $138 | $188 | $288 | $68 from 6 |

- Session cap `CAP = 5000` across both tables.
- Qualifying seats are chosen **by the dealer**, who checks bet history on the table ($100 Banker/Player + $15 side bet on every hand of the streak).

## State

Per table, `S.T.BC1` / `S.T.BC2`:

```
phase, scheme, dstyle, fx, feed,
res[]        results B / P / T
side, len    current streak
paid         prizes paid
stats{}      per MB#: won, dragons, slays
hist[]       per hand: time, result, streak, event, prizes
awards[]     per prize: time, table, hand, type, seat, MB#, amount, handover
st[5]        seats: on, mb
ticker[]
```

## Sync

`syncInit()` / `push()` / `applyRemote()` in `js/app.js`. The host writes `{T, events:[{seq, o}]}` to `live/BC1` or `live/BC2`; the display subscribes and replays new `events` (overlays) by `seq`.

The current code calls `claude.use('db')`, which exists only inside claude.ai. To run on your own network, replace those calls with a realtime store (WebSocket server, Firebase, Supabase…) and keep the same payload and replay logic.

## Export

Dealer Control → **Export winners (members)** (sheets *Win history*, *Members*) or **Full history** (*Summary*, *Hands*, *Prizes*, *Top Hunters*, *Audit log*). Uses SheetJS 0.18.5 from cdnjs, loaded on first export, and a normal browser download outside claude.ai.

## Notes

- Full MB# is kept in state and exports; the LED shows `MB ••1234` only. Don't commit real session exports.
- Demo mode shows two example BC2 rows on Top Hunters; the MB numbers in the demo are fake.
- External loads: Google Fonts (Montserrat) and SheetJS. Self-host them for an offline venue.
- Tested in Chromium at 1600×1000 and 1920×1080. Not yet tested on Safari, the venue LED or iPad.

## Licence

© Vegas Club. All rights reserved. The dragon video clips and the gold dragon image are supplied by Vegas Club Marketing; check their licences before making this repository public.
