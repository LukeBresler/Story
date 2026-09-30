# 37 Elephants

A real-time mobile game about watching over a herd of 37 elephants in Amboseli, Kenya, beneath Kilimanjaro.

- **Real time, real place.** The clock, sunrise and sunset, moon phase and seasons follow Amboseli's actual local time (East Africa Time, UTC+3). The long rains (March–May), short rains (November–December) and dry seasons change the landscape, the waterhole, the weather and how thirsty and hungry the herd gets.
- **37 individuals.** Three families and one travelling bull. Every elephant has a Swahili name and its meaning, an age, a mother, a personality, favourite things and a birthday. Calves follow their mothers around, have bigger heads and eyes, and fall asleep at night.
- **Things happen.** Youngsters wander off, lions and hyenas stalk the calves (mostly at night and dusk), poachers appear, thorns and droughts strike, calves are born, and birthdays come around. Elephants grieve when one of them dies.
- **The herd lives on without you.** When you come back, a "While you were away" report tells you what happened. The matriarchs keep the herd watered and fed and avoid most danger while you're gone, and losses per absence are capped.
- **Three journeys.** When the last elephant is gone the game thanks you for playing. Each player gets three journeys in total; after the third, the game can't be started again.

## Playing

| Action | What it does |
| --- | --- |
| **Water** / **Graze** | Lead the herd to the waterhole or out to graze. Returns are lower in the dry season. |
| **Gather** | The adults form a circle around the calves. Stops lions and hyenas. |
| **Rangers** | Stops poachers and finds lost elephants. Has a cooldown. |
| **Tap an elephant** | Opens a quick card. Tap again, or press **Comfort**, to comfort them (hearts, rumbles, trumpets). |
| **Herd** | Everyone's profile, family ties, health, happiness and your bond. |

Drag the landscape sideways to look around.

## Running it

It's a static site with no build step. ES modules need to be served over HTTP:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Open `http://localhost:8000` on your phone (same Wi-Fi network: use your computer's IP) or in a mobile-emulated browser. To install it like an app, use "Add to Home Screen" (iOS Safari) or "Install app" (Android Chrome). It's a PWA with an offline cache.

To publish it, any static host works: GitHub Pages (Settings → Pages → deploy from this branch, root), Netlify, Vercel or Cloudflare Pages.

## Dev mode

Unlock it in one of three ways:

- Open the game with `?dev` in the URL, e.g. `http://localhost:8000/?dev`
- Tap the big **37** logo on the title screen 7 times
- Tap the version line at the bottom of the in-game menu 7 times

Then open it from **Menu → Dev mode** (or the "Dev mode" link on the title screen). You can:

- **Journeys (lives):** add or remove journeys, or reset to 3
- **Herd:** add elephants, restore to 37, heal and feed everyone, kill one, or end the game
- **Trigger events:** wanderer, lions, hyenas, poachers, birth, drought, injury, happy moment, make rangers ready
- **Time & season:** speed up the clock (up to 1 second = 1 hour), force a season, force the time of day, skip ahead an hour or a day, return to real time
- **Settings:** event frequency, threat lethality, thirst and hunger speed, time to answer threats, wanderer grace period, ranger cooldown, max deaths per absence, births on/off, god mode
- **Wipe all data**

## How the "3 journeys" limit works (and its limits)

Journeys are counted in the browser's `localStorage` on the player's device. That's enough for a casual limit, but a player can reset it by clearing site data or using another browser or device. Enforcing it for real needs accounts and a server that records plays. Dev mode is also client-side only, so it isn't a security boundary.

## Code map

```
index.html            App shell and HUD markup
css/style.css         All styling (glass UI, sheets, screens)
js/main.js            Bootstrap, screens, game loop, save/load
js/env.js             Amboseli clock, seasons, NOAA solar position, moon phase, weather
js/game.js            Simulation: needs, wellbeing, events, threats, births, deaths, offline catch-up
js/herd.js            The 37 elephants, families, personalities, ambient lines
js/render.js          Canvas scene: sky, Kilimanjaro, weather, herd behaviour, camera, portraits
js/sprites.js         Procedural vector art: elephants, lions, hyenas, egrets, trees, vehicles
js/ui.js              HUD, alerts, herd and profile sheets, journal, menu, moments
js/dev.js             Dev mode panel
js/audio.js           Synthesised soundscape (wind, birds, crickets, rain, rumbles, trumpets)
js/storage.js         localStorage persistence
sw.js                 Offline cache
```

All art and sound are generated in code, so there are no image or audio assets to license.
