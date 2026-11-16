# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/calebakinjomo/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/calebakinjomo/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed DefiLlama snapshot of 758 protocols, ranks every pre-token protocol by an implied launch value, and hands back a static dashboard you can open with no network.

The value model is calibrated from the snapshot itself, never from a list of names. For each category it takes the median market cap per dollar of TVL of the protocols in that category that already trade (a category with fewer than three trading protocols takes the global median), then scores a pre-token protocol as TVL x that multiple, adjusted for seven-day growth (clamped to -50%..+100%, half weight) and for how long it has run with no token (maturity from 0.6 to 1.0 over three years). The board covers all 40 watchlist protocols plus 186 more pre-token protocols below the $50M TVL floor, 226 rows in total, and sets the 24 live-token protocols aside with their market caps shown. Every row carries a concrete seven-step farm plan with the capital, the gas and the time each step takes.

The dashboard is a single static page (index.html + app.css + app.js, data inlined in data.js): a sortable, filterable board, a top-three spotlight that follows the filter, a detail view for every protocol showing the model's own inputs and the page's recomputation of the same number, and a model panel that publishes the formula and every calibrated category multiple.

## Run it

```sh
# Node 22. In the grading sandbox the sealed snapshot is at /input/snapshot.json
# and the output goes to $MAKEFUN_OUTPUT_DIR (or /output). Locally:
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
# then open out/dashboard/index.html — data.js beside it carries the board.
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=hdavhdvz&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
