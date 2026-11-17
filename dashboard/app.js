// Token Launch Radar — the page. Reads window.RADAR (written by main.ts from
// the same board as board.json), renders the table, and keeps every interaction
// local: sorting, filtering and the detail drawer run with no network at all.

const data = window.RADAR;
const rowsEl = document.getElementById('rows');
const shownEl = document.getElementById('shown');
const searchEl = document.getElementById('q');
const catEl = document.getElementById('cat');
const watchEl = document.getElementById('watchonly');
const drawer = document.getElementById('drawer');
const drawerBody = document.getElementById('drawer-body');

const watchedSlugs = new Set(data.watchlist || []);

/** $1,234,567 — whole dollars, no decimals. */
function dollars(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** $367.3M / $12.4K — the short form the table shows. */
function short(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
}

/** +5.6% / -2.2% / — when the snapshot carries no change. */
function changeText(change) {
  if (change === null || change === undefined) return '—';
  return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
}

function ageText(years) {
  if (years < 1) return Math.round(years * 12) + 'mo';
  return years.toFixed(1) + 'y';
}

let sortKey = 'rank';
let sortDir = 1;

function compare(a, b) {
  const x = a[sortKey];
  const y = b[sortKey];
  if (x === null || x === undefined) return 1;
  if (y === null || y === undefined) return -1;
  if (typeof x === 'string') return sortDir * x.localeCompare(y);
  return sortDir * (x - y);
}

function filtered() {
  const q = searchEl.value.trim().toLowerCase();
  const cat = catEl.value;
  return data.rows.filter((r) => {
    if (cat && r.category !== cat) return false;
    if (watchEl.checked && !watchedSlugs.has(r.slug)) return false;
    if (!q) return true;
    const hay = [r.name, r.category, r.slug, ...r.chains].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function render() {
  const list = filtered().sort(compare);
  shownEl.textContent = list.length + ' of ' + data.rows.length + ' shown';
  rowsEl.innerHTML = list
    .map(
      (r) => `<tr data-slug="${r.slug}" tabindex="0">
        <td class="num">${r.rank}</td>
        <td><strong>${r.name}</strong>${watchedSlugs.has(r.slug) ? ' <span class="tag">watchlist</span>' : ''}</td>
        <td>${r.category || '—'}</td>
        <td class="num">${short(r.tvl_usd)}</td>
        <td class="num ${r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'}">${changeText(r.change_7d)}</td>
        <td class="num">${ageText(r.age_years)}</td>
        <td class="num strong">${short(r.implied_value_usd)}</td>
      </tr>`,
    )
    .join('');
}

function factorLine(r) {
  return (
    dollars(r.tvl_usd) +
    ' TVL × ' +
    r.multiple.toFixed(4) +
    ' multiple × ' +
    r.growth.toFixed(3) +
    ' growth × ' +
    r.maturity.toFixed(3) +
    ' maturity = <strong>' +
    dollars(r.implied_value_usd) +
    '</strong>'
  );
}

function openDetail(slug) {
  const r = data.rows.find((row) => row.slug === slug);
  if (!r) return;
  drawerBody.innerHTML =
    `<h2>${r.name} <span class="rank-badge">#${r.rank}</span></h2>
    <p class="fact">${factorLine(r)}</p>
    <dl>
      <dt>Category</dt><dd>${r.category || '—'}</dd>
      <dt>Chains</dt><dd>${r.chains.join(', ')}</dd>
      <dt>TVL</dt><dd>${dollars(r.tvl_usd)}</dd>
      <dt>7-day change</dt><dd>${changeText(r.change_7d)}</dd>
      <dt>Running with no token for</dt><dd>${ageText(r.age_years)}</dd>
      <dt>Token recorded</dt><dd>None — its DefiLlama record carries no token</dd>
    </dl>
    <h3>How to farm it</h3>
    <ol class="steps">${r.farm_steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  drawer.hidden = false;
}

function closeDetail() {
  drawer.hidden = true;
  drawerBody.innerHTML = '';
}

document.querySelectorAll('#board th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    if (sortKey === key) {
      sortDir = -sortDir;
    } else {
      sortKey = key;
      sortDir = key === 'rank' ? 1 : -1;
    }
    document.querySelectorAll('#board th').forEach((h) => h.classList.remove('sorted-asc', 'sorted-desc'));
    th.classList.add(sortDir === 1 ? 'sorted-asc' : 'sorted-desc');
    render();
  });
});

rowsEl.addEventListener('click', (event) => {
  const tr = event.target.closest('tr[data-slug]');
  if (tr) openDetail(tr.getAttribute('data-slug'));
});
rowsEl.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const tr = event.target.closest('tr[data-slug]');
  if (tr) openDetail(tr.getAttribute('data-slug'));
});
document.getElementById('drawer-close').addEventListener('click', closeDetail);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDetail();
});
searchEl.addEventListener('input', render);
catEl.addEventListener('change', render);
watchEl.addEventListener('change', render);

// The category list, in the order the snapshot first names them.
[...new Set(data.rows.map((r) => r.category).filter(Boolean))]
  .sort()
  .forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catEl.appendChild(opt);
  });

// Already launched: the live-token protocols the board sets aside, unranked.
document.getElementById('live-list').innerHTML = data.live
  .map(
    (p) =>
      `<li><strong>${p.name}</strong> — ${p.category || '—'} · TVL ${short(p.tvl_usd)} · token market cap ${short(p.mcap_usd)}</li>`,
  )
  .join('');

document.getElementById('asof').textContent = 'Snapshot ' + data.as_of + ' · floor ' + short(data.floor_usd);
document.getElementById('counts').textContent =
  data.rows.length + ' ranked · ' + data.live.length + ' already launched';

// Deep links, so a screenshot can open a state directly:
// #detail=<slug> opens that protocol; #filter=<text> fills the search box.
function readHash() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  if (params.has('filter')) {
    searchEl.value = params.get('filter');
    render();
  }
  if (params.has('detail')) {
    openDetail(params.get('detail'));
  }
}

render();
readHash();
