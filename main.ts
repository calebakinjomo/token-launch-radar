// Token launch radar — entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot, scores the board with the model in lib/model.ts,
// and writes everything the gate and the judge need into the output directory:
//
//   board.json     the ranked board (rows carry their farm plans and factors)
//   data.js        the same rows, as a script the dashboard reads
//   dashboard/     the static page (index.html, app.js, app.css)
//   screenshots/   the three views of the running dashboard
//   dossier.json   the summary the judge reads, built by the vendored library
//
// The snapshot comes from /input/snapshot.json in the grader, or from --input
// <snapshot.json|directory> anywhere else. The output goes to /output, or to
// MAKEFUN_OUTPUT_DIR / --output outside the grader. Every run writes the same
// bytes: no clock, no randomness, files copied in sorted order.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardDataScript, checkBoard, loadSnapshot, rankBoard } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const TEXT_CAP = 65_536;
const SHOT_CAP = { max: 4, max_bytes: 524_288 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read `--name value` or `--name=value` from the arguments, else the fallback. */
function flag(name: string, fallback: string): string {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]!;
    if (item === `--${name}` && i + 1 < argv.length) return argv[i + 1]!;
    if (item.startsWith(`--${name}=`)) return item.slice(name.length + 3);
  }
  return fallback;
}

function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

const inputGiven = flag('input', '/input');
const snapshotPath = inputGiven.endsWith('.json') ? inputGiven : path.join(inputGiven, 'snapshot.json');
if (!fs.existsSync(snapshotPath)) {
  fail(`no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

let snapshot;
try {
  snapshot = loadSnapshot(fs.readFileSync(snapshotPath, 'utf8'));
} catch (error) {
  fail(`cannot read the snapshot: ${error instanceof Error ? error.message : String(error)}`);
}

let radar;
try {
  radar = rankBoard(snapshot);
} catch (error) {
  fail(`cannot score the board: ${error instanceof Error ? error.message : String(error)}`);
}
const problem = checkBoard(radar, snapshot);
if (problem !== null) fail(`the model wrote a board the gate refuses: ${problem}`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'board.json'), `${JSON.stringify({ rows: radar.rows })}\n`);
fs.writeFileSync(path.join(outDir, 'data.js'), boardDataScript(radar));

/** Copy a directory's regular files into `to`, in sorted order, skipping dotfiles. */
function copyDir(from: string, to: string): string[] {
  if (!fs.existsSync(from)) return [];
  fs.mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of fs.readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const source = path.join(from, name);
    if (!fs.statSync(source).isFile()) continue;
    fs.copyFileSync(source, path.join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashboardFiles = copyDir(path.join(repoRoot, 'dashboard'), path.join(outDir, 'dashboard'));
if (!dashboardFiles.includes('index.html')) fail('dashboard/ holds no index.html');
if (!dashboardFiles.some((name) => name.endsWith('.css'))) fail('dashboard/ holds no .css file');
if (!dashboardFiles.some((name) => name.endsWith('.js'))) fail('dashboard/ holds no .js file');

const shots = copyDir(path.join(repoRoot, 'screenshots'), path.join(outDir, 'screenshots'));
if (shots.length < 3) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
}
for (const name of shots) {
  if (!SHOT_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last: the scorer rebuilds it from this output and compares bytes.
fs.writeFileSync(
  path.join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: TEXT_CAP,
    screenshots: SHOT_CAP,
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ` +
    `${radar.rows.length} rows scored (${radar.live.length} live set aside)\n` +
    `token radar: top 3: ${radar.rows
      .slice(0, 3)
      .map((r) => `#${r.rank} ${r.name} $${r.implied_value_usd.toLocaleString('en-US')}`)
      .join(', ')}\n` +
    `token radar: wrote ${path.join(outDir, 'board.json')}, ${path.join(outDir, 'data.js')}, ` +
    `${path.join(outDir, 'dashboard')} (${dashboardFiles.length} files), ` +
    `${path.join(outDir, 'screenshots')} (${shots.length} images) and ${path.join(outDir, 'dossier.json')}\n`,
);
