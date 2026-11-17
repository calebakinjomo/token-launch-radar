# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/calebakinjomo/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/calebakinjomo/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 226 pre-token protocols ranked by what their token would be worth if it launched tomorrow and nothing else changed. Each row carries a seven-step farm plan with costs and times. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The model

Implied value = TVL × category multiple × growth × maturity.

- **Category multiple** — the median market-cap-per-$1-TVL of live-token protocols in the same category (at least two of them, each holding $10M+ of TVL); a category with fewer falls back to the global median. Both medians are recomputed from the sealed snapshot on every run.
- **Growth** — the protocol's seven-day TVL change at half weight, clamped to −50%…+100%.
- **Maturity** — how long the protocol has run with no token: age in years over age + 0.4.

Every figure comes from the snapshot at `input/snapshot.json` (sealed DefiLlama data, as of 2026-11-14). No protocol name is hardcoded anywhere in the model.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Node 22 or later, standard library only. The program reads the snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. Running it twice writes the same bytes.

## The board

- All 40 protocols on the snapshot's watchlist, plus the 186 largest pre-token protocols below the $50M floor — 226 rows in all.
- Top of the board on this snapshot: Steakhouse Financial (~$363M), Gauntlet (~$216M), USDD (~$142M).
- A separate "already launched" list holds the live-token protocols the board sets aside, so the ranking stays a ranking of launches still to come.
- Open `dashboard/index.html` (served from the output directory) to sort, filter and open any protocol's detail drawer with its factor breakdown and farm plan.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hdavhdvz&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
