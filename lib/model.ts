// Token launch radar — the "radar-2" value model, written fresh for this entry.
//
// The question the board answers: if a protocol that records no token issued one
// tomorrow and its record stayed as it is, what would that token be worth? The
// answer is built only from the sealed snapshot — no hardcoded names, no outside
// data — so the same program run on the same snapshot always writes the same board.
//
//   implied value = TVL x category multiple x growth x maturity
//
// - TVL is the protocol's own locked value, in whole dollars.
// - The category multiple is the median market-cap-per-$1-TVL of the live-token
//   protocols in the same category (at least two of them, each holding $10M or
//   more of TVL and a positive market cap — a token recorded at $0 is a dead
//   project, not a pricing signal). A category with fewer than two live comps
//   falls back to the global median across all such live protocols. Both
//   medians are recomputed from the snapshot on every run; nothing about them
//   is baked in.
// - Growth is the protocol's seven-day TVL change, counted at half weight and
//   clamped to [-50%, +100%], so a hot week lifts the value and a cold week
//   trims it without ever letting one week decide the ranking.
// - Maturity is how long the protocol has run with no token: age in years over
//   age + 0.4, so a year of waiting is worth about 0.71 and a year and a half
//   about 0.79. A protocol DefiLlama only just started tracking counts as a
//   quarter of a year old. Waiting longer without issuing a token is read as a
//   longer runway for the launch, never as a promise that one comes.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_years: number;
  multiple: number;
  growth: number;
  maturity: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
}

export interface Radar {
  as_of: string;
  source: string;
  floor_usd: number;
  model: string;
  watchlist: string[];
  rows: BoardRow[];
  live: LiveRow[];
  counts: { protocols: number; watchlist: number; rows: number; live_set_aside: number };
}

/** Live-token comps need this much TVL to count toward a multiple. */
const COMP_MIN_TVL = 10_000_000;
/** A category needs at least this many live comps before its own median is used. */
const COMP_MIN_COUNT = 2;
/** Board rows: the whole watchlist, plus this many pre-token protocols below the floor. */
const BELOW_FLOOR_ROWS = 186;
/** Live-token protocols shown apart from the board, so the page separates them. */
const LIVE_SET_ASIDE = 12;

/** The median of a non-empty list of numbers. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Parse and lightly validate the sealed snapshot. */
export function loadSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new Error('snapshot: expected protocols and watchlist arrays');
  }
  if (typeof raw.floor_usd !== 'number' || typeof raw.as_of !== 'string') {
    throw new Error('snapshot: expected floor_usd and as_of');
  }
  return raw;
}

/** Whole years between a listing date and the snapshot date; unknown counts as young. */
export function ageYears(listedAt: string | null, asOf: string): number {
  if (listedAt === null) return 0.25;
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0.25;
  return (end - start) / (365.25 * 24 * 60 * 60 * 1000);
}

/** Seven-day TVL change at half weight, clamped so one week cannot dominate. */
export function growthFactor(change7d: number | null): number {
  const change = change7d === null ? 0 : Math.max(-50, Math.min(100, change7d));
  return 1 + change / 200;
}

/** How long the protocol has run with no token, as a 0-to-1 weight. */
export function maturityFactor(age: number): number {
  return age <= 0 ? 0 : age / (age + 0.4);
}

/**
 * The category multiples: for every category, the median mcap-per-$1-TVL of its
 * live-token protocols holding at least $10M of TVL, when there are at least two
 * of them; otherwise the global median over all such live protocols. A comp
 * needs a positive market cap: a token DefiLlama records at $0 is a dead
 * project, not a pricing signal, and a zero ratio would drag every median down.
 */
export function categoryMultiples(snapshot: Snapshot): { byCategory: Map<string, number>; global: number } {
  const comps = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= COMP_MIN_TVL,
  );
  const global = median(comps.map((p) => p.mcap_usd! / p.tvl_usd));
  const perCategory = new Map<string, number[]>();
  for (const p of comps) {
    if (p.category === null) continue;
    const list = perCategory.get(p.category) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    perCategory.set(p.category, list);
  }
  const byCategory = new Map<string, number>();
  for (const [category, ratios] of perCategory) {
    if (ratios.length >= COMP_MIN_COUNT) byCategory.set(category, median(ratios));
  }
  return { byCategory, global };
}

/** A protocol records no token when DefiLlama carries neither id nor symbol for it. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/** The one action that earns a future allocation in a protocol of this category. */
function coreAction(category: string | null): string {
  switch (category) {
    case 'Lending':
      return 'Supply stablecoins or ETH to its lending markets and keep the deposit working';
    case 'Dexs':
      return 'Swap through it and provide liquidity to one of its pools';
    case 'CDP':
      return 'Mint its stablecoin against collateral and keep the position healthy';
    case 'Yield':
    case 'Yield Aggregator':
      return 'Deposit into its vaults and let the yield compound';
    case 'Risk Curators':
    case 'Onchain Capital Allocator':
      return 'Deposit into its curated vaults and stay in through a full cycle';
    case 'RWA':
      return 'Use its tokenised real-world products on-chain';
    case 'Liquid Staking':
    case 'Liquid Restaking':
      return 'Stake through it and hold the receipt token';
    case 'Derivatives':
      return 'Open and manage a position on its markets';
    case 'Bridge':
    case 'Canonical Bridge':
    case 'Cross Chain Bridge':
      return 'Bridge assets through it on the routes you actually use';
    default:
      return 'Use its app for the thing it is built for, on its main chain';
  }
}

/**
 * Seven concrete farm steps for one protocol, each 20 to 600 characters. Costs
 * and times are stated on every step, and the last step is the exit: a plan
 * that never says how to leave is not a plan.
 */
export function farmSteps(p: SnapshotProtocol): string[] {
  const chain = p.chains[0] ?? 'its main chain';
  const others = p.chains.length > 1 ? ` It also runs on ${p.chains.slice(1, 3).join(', ')}.` : '';
  const action = coreAction(p.category);
  return [
    `Set up a fresh wallet and fund it with $50–$200 on ${chain}; bridging in usually costs $1–$5 and takes 2–10 minutes. Keep a little gas aside for several transactions.${others}`,
    `${action} on ${chain} and leave the position working for at least 4 weeks; a position that sits for a month counts for more than a deposit withdrawn the same day.`,
    `Come back once a week for 8–12 weeks and repeat the core action, so the activity reads as real usage instead of a one-day burst; each visit costs a few dollars in gas.`,
    `Check whether ${p.name} publishes points, quests or a leaderboard, and finish the free ones; a paid quest should cost under $5 or it is not worth doing.`,
    `Hold a modest position of $50–$200 rather than a large one; if a token ever comes, it usually rewards consistent small users more than a single whale deposit.`,
    `Watch ${p.name}'s own announcements for a token or points snapshot, and never pay anyone offering to pre-sell the token — there is no token yet, so any seller is a scam.`,
    `Know the exit before you enter: withdrawing on ${chain} is usually one transaction costing $1–$5. Leave if lockups or fees rise above what the position earns.`,
  ];
}

/** Score every board protocol and rank them by implied value, highest first. */
export function rankBoard(snapshot: Snapshot): Radar {
  const { byCategory, global } = categoryMultiples(snapshot);
  const watched = new Set(snapshot.watchlist);
  const listed = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    if (!listed.has(slug)) throw new Error(`snapshot: watchlist names ${slug}, which the protocols list does not hold`);
  }
  const preToken = snapshot.protocols.filter(recordsNoToken);
  const belowFloor = preToken
    .filter((p) => p.tvl_usd < snapshot.floor_usd && !watched.has(p.slug))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, BELOW_FLOOR_ROWS);
  const chosen = [
    ...snapshot.protocols.filter((p) => watched.has(p.slug)),
    ...belowFloor,
  ];
  const scored: BoardRow[] = chosen.map((p) => {
    const multiple = p.category !== null && byCategory.has(p.category) ? byCategory.get(p.category)! : global;
    const age = ageYears(p.listed_at, snapshot.as_of);
    const growth = growthFactor(p.change_7d);
    const maturity = maturityFactor(age);
    const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growth * maturity));
    return {
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: farmSteps(p),
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_years: Math.round(age * 100) / 100,
      multiple: Math.round(multiple * 10_000) / 10_000,
      growth: Math.round(growth * 10_000) / 10_000,
      maturity: Math.round(maturity * 10_000) / 10_000,
    };
  });
  scored.sort(
    (a, b) =>
      b.implied_value_usd - a.implied_value_usd ||
      b.tvl_usd - a.tvl_usd ||
      (a.slug < b.slug ? -1 : 1),
  );
  scored.forEach((row, i) => {
    row.rank = i + 1;
  });
  const live: LiveRow[] = snapshot.protocols
    .filter((p) => p.mcap_usd !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_SET_ASIDE)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
    }));
  return {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model:
      'implied value = TVL x category multiple x growth x maturity; ' +
      'multiple = median mcap per $1 TVL of live-token protocols in the category ' +
      '(at least 2 comps of $10M+ TVL, else the global median); ' +
      'growth = 1 + clamped 7-day TVL change / 200; ' +
      'maturity = age in years / (age + 0.4)',
    watchlist: [...snapshot.watchlist],
    rows: scored,
    live,
    counts: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      rows: scored.length,
      live_set_aside: live.length,
    },
  };
}

/** The dashboard's data file: the same rows the board holds, plus the live list. */
export function boardDataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar, null, 2)};\n`;
}

/**
 * The gate's own shape, checked before anything is written: ranks 1..N once
 * each, values never rising as rank ascends, every watchlist slug present, every
 * row's farm steps 3 to 12 strings of 20 to 600 characters. Returns the first
 * problem, or null when the board is clean.
 */
export function checkBoard(radar: Radar, snapshot: Snapshot): string | null {
  const rows = radar.rows;
  if (rows.length < 100 || rows.length > 4000) return `board holds ${rows.length} rows, outside 100 to 4000`;
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.slug)) return `board repeats slug ${row.slug}`;
    seen.add(row.slug);
    if (!Number.isInteger(row.implied_value_usd) || row.implied_value_usd <= 0) {
      return `row ${row.slug} has a non-positive implied value`;
    }
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `row ${row.slug} holds ${row.farm_steps.length} farm steps, outside 3 to 12`;
    }
    for (const step of row.farm_steps) {
      const trimmed = step.trim();
      if (trimmed.length < 20 || trimmed.length > 600) {
        return `row ${row.slug} holds a farm step of ${trimmed.length} characters, outside 20 to 600`;
      }
    }
  }
  const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i += 1) {
    if (ranks[i] !== i + 1) return `ranks are not exactly 1 to ${rows.length}`;
  }
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i]!.implied_value_usd > rows[i - 1]!.implied_value_usd) {
      return `implied value rises from rank ${i} to rank ${i + 1}`;
    }
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  return null;
}
