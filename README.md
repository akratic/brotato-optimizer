# Brotato Optimizer

Brute-force DPS & eHP level-up optimizer for [Brotato](https://store.steampowered.com/app/1942280/Brotato/). For every weapon it supports, tries every combination of level-up points (N=0..100) across the weapon's damage stat, Damage%, Attack Speed, and Crit Chance, and keeps whichever combination maximizes DPS. Does the same for HP/Armor/Dodge to maximize effective HP.

Live at **https://akratic.github.io/brotato-optimizer/**

## How it works

- `weapons.csv` is exported from [ArosRising's Brotato MultiTool 1.4](https://docs.google.com/spreadsheets/d/1qi_KWBH_fQlrXJioDGJQScuRbwfndHzLu4Zj5Ek0Aso/edit?gid=1643867668#gid=1643867668) via `regenerate_weapons_csv.py`. `dps_optimizer.py` reimplements that spreadsheet's DPS Calculator formula in Python; `ehp_optimizer.py` does the same for effective HP.
- `build_site_data.py` runs the brute-force search for every weapon the model supports and writes the results as static JSON under `site/public/data/`, consumed by the React/Vite frontend in `site/`.
- Deployed to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`.

## Data corrections

The spreadsheet export isn't always right. Each of these was verified against the [Brotato wiki](https://brotato.wiki.spellsandguns.com/Weapons) before changing:

- **Jousting Lance** scales with Speed, not just Melee Damage — the spreadsheet's "Special Stat Name" column was left at the generic placeholder instead of naming it. Tiers 2-4 actually favor investing in Speed over Melee Damage.
- **Hatchet**: spreadsheet said 15% Attack Speed scaling; wiki says 20%. Wiki confirmed correct.
- **Taser**: spreadsheet said a flat 80% Elemental Damage scaling for tiers 2-4; wiki says 70%/60%/50% (decreasing per tier). Wiki confirmed correct.
- **Railgun 3**: spreadsheet says 90% Ranged Damage; wiki says 80%. Checked in-game - the spreadsheet (90%) is correct here, the wiki is wrong. No change made.
- Hybrid weapons that scale with two or three different stats at once (e.g. Plank: Melee + Elemental + Engineering) invest every level-up point into whichever single stat has the highest effective coefficient - provably optimal for this game's damage formula (each stat's contribution is summed independently, so splitting points across stats never beats concentrating them), not a heuristic.

## Development

```
python3 build_site_data.py --n 10     # fast, for local dev
python3 build_site_data.py --n 100    # full production dataset (slow - brute force)
cd site && npm run dev
```
