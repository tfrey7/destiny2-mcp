# Annotated inventory screens

Source captures and the generators for the three annotated figures in `../bungie-api.md`.
All three screens are **current** (Edge of Fate / Armor 3.0, Season 27) so the labels match the
attribute fields this server actually emits.

## Sources (real in-game screenshots, not mockups)

| File | Screen | Source |
|---|---|---|
| `character-screen.jpg` | Character / equipment screen (Season 27) | wowvendor.com — Edge of Fate hub |
| `weapon-detail.jpg` | Weapon inspect (Phoneutria Fera, Hand Cannon) | thegamepost.com — EoF legendary weapons & perks |
| `armor-detail.jpg` | Armor inspect (Aion Renewal Strides, Leg Armor) | thegamer.com — EoF armor rework guide |

## Regenerating the annotated PNGs

`render.js` draws the callout layer (labels in the margins, leader lines to image coordinates).
Each `*.html` is just a config (`window.__CFG__`) listing annotations as `{ t:[x,y], side, code, sub }`
where `t` is a pixel coordinate in the source image. To rebuild:

1. Serve this folder: `python3 -m http.server 8731`
2. Open `character.html` / `weapon.html` / `armor.html`, screenshot the `#stage` element.
3. Save into `../` as `inventory-screen-annotated.png`, `weapon-detail-annotated.png`,
   `armor-detail-annotated.png`.

Blue labels = static manifest definition; gold labels = live per-instance / profile data — the same
two-data-planes split the doc explains.
