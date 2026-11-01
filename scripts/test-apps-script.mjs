// Run with: npm run check
// Exercises apps-script/Code.gs against generated sample data and a fake GitHub.
import assert from 'node:assert/strict';
import { createRuntime, makeSheetGrids, TOKEN } from './harness.mjs';

const MU_BUS = ['Central Functions', 'PG Programme', 'PG Programme (Bharat)', 'UG Programme', 'Executive Education'];
const TETR_BUS = ['TETR Central Functions', 'TETR UG Programme', 'TETR PG Programme', 'TETR Executive Programme'];

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

const rt = createRuntime();
const first = rt.publish();
const mu = rt.file('mu');
const tetr = rt.file('tetr');

// ---------- what gets published ----------

ok('first publish creates both files, in the data folder', () => {
  assert.deepEqual(first.map((r) => `${r.unit}:${r.result}`), ['mu:created', 'tetr:created']);
  assert.deepEqual([...rt.state.github.files.keys()].sort(), ['public/data/mu.json', 'public/data/tetr.json']);
  assert.ok(rt.state.github.commits.every((c) => c.branch === 'main'));
});

ok('each file lists exactly its own Business Units', () => {
  assert.deepEqual(mu.businessUnits.map((b) => b.label), MU_BUS);
  assert.deepEqual(tetr.businessUnits.map((b) => b.label), TETR_BUS);
});

ok('jobs only ever sit in their own unit (full-name matching)', () => {
  for (const j of mu.jobs) assert.ok(MU_BUS.includes(j.businessUnit), `MU got ${j.businessUnit}`);
  for (const j of tetr.jobs) assert.ok(TETR_BUS.includes(j.businessUnit), `TETR got ${j.businessUnit}`);
  const muIds = new Set(mu.jobs.map((j) => j.jobId));
  assert.equal(tetr.jobs.filter((j) => muIds.has(j.jobId)).length, 0);
  assert.ok(mu.jobs.length > 0 && tetr.jobs.length > 0);
});

ok('JOB_10 is gone everywhere, JOB_100-style IDs are not', () => {
  for (const u of [mu, tetr]) assert.ok(!u.jobs.some((j) => j.jobId === 'JOB_10'));
  const grids = makeSheetGrids();
  grids.Manpower.push(['JOB_100', 'UG Programme (UGP)', 'Admissions', 'Open', '2', '0', '0', '0', '0', '2', 'C']);
  grids.Manpower.push([' job_10 ', 'UG Programme (UGP)', 'Admissions', 'Open', '9', '0', '0', '0', '0', '9', 'C']);
  const r = createRuntime({ grids });
  r.publish();
  const out = r.file('mu');
  assert.ok(out.jobs.some((j) => j.jobId === 'JOB_100'), 'JOB_100 wrongly dropped');
  assert.ok(!out.jobs.some((j) => j.jobId.trim().toLowerCase() === 'job_10'), 'job_10 variant leaked');
});

ok("JOB_10's candidates are not counted", () => {
  const counted = [...mu.businessUnits, ...tetr.businessUnits].reduce((a, b) => a + b.candidates.total, 0);
  const grids = makeSheetGrids();
  const jobCol = grids['Candidate Data'][0].indexOf('Job Id');
  const job10 = grids['Candidate Data'].filter((r, i) => i > 0 && r[jobCol] === 'JOB_10').length;
  assert.ok(job10 > 0, 'sample data should contain JOB_10 candidates');
  assert.ok(counted <= grids['Candidate Data'].length - 1 - job10, 'JOB_10 candidates were counted');
});

ok('unmapped and look-alike Business Units are ignored', () => {
  assert.ok(![...mu.jobs, ...tetr.jobs].some((j) => j.jobId === 'JOB_999'));
  const grids = makeSheetGrids();
  grids.Manpower.push(['JOB_555', 'PG Programme', 'Admissions', 'Open', '3', '0', '0', '0', '0', '3', 'C']);
  grids.Manpower.push(['JOB_556', 'TETR PG Programme', 'Admissions', 'Open', '3', '0', '0', '0', '0', '3', 'C']);
  const r = createRuntime({ grids });
  r.publish();
  assert.ok(!r.file('mu').jobs.some((j) => j.jobId === 'JOB_555'));
  assert.ok(!r.file('tetr').jobs.some((j) => j.jobId === 'JOB_556'));
});

ok('PG Programme (Bharat) is listed with zeros', () => {
  const b = mu.businessUnits.find((x) => x.label === 'PG Programme (Bharat)');
  assert.equal(b.manpower.total, 0);
  assert.equal(b.candidates.total, 0);
});

ok('totals add up per unit', () => {
  for (const u of [mu, tetr]) {
    assert.equal(u.businessUnits.reduce((a, b) => a + b.manpower.total, 0), u.jobs.reduce((a, j) => a + j.total, 0));
    assert.equal(
      u.businessUnits.reduce((a, b) => a + b.manpower.openRoles, 0),
      u.jobs.filter((j) => j.status.toLowerCase() === 'open').length
    );
  }
});

ok('no personal details or other unit data in the published files', () => {
  const muText = JSON.stringify(mu);
  const tetrText = JSON.stringify(tetr);
  for (const text of [muText, tetrText]) {
    assert.ok(!/Person Name/.test(text), 'name leaked');
    assert.ok(!/@example\.com/.test(text), 'email leaked');
    assert.ok(!/\b98\d{8}\b/.test(text), 'phone leaked');
    assert.ok(!/CAD_\d+/.test(text), 'candidate id leaked');
  }
  assert.ok(!/TETR/.test(muText), 'MU file mentions TETR');
  assert.ok(!/Executive Education|"PG Programme"|"UG Programme"|Central Functions"/.test(tetrText.replace(/TETR [A-Za-z ]+/g, '')));
});

ok('the inconsistent row is flagged', () => {
  assert.ok(tetr.checks.some((c) => c.jobId === 'JOB_791'));
});

ok('the published files have the shape the website expects', () => {
  for (const u of [mu, tetr]) {
    assert.deepEqual(Object.keys(u).sort(), ['businessUnits', 'checks', 'fetchedAt', 'jobs', 'source', 'unit']);
    assert.ok(!Number.isNaN(new Date(u.fetchedAt).getTime()));
  }
});

ok('one recruiter with different ID formats is counted once; referrers are grouped', () => {
  const grids = makeSheetGrids();
  const g = grids['Candidate Data'];
  const h = g[0];
  const col = (n) => h.indexOf(n);
  const base = g[1].slice();
  const add = (over) => {
    const row = base.slice();
    row[col('Business Unit')] = 'UG Programme (UGP)';
    row[col('Job Id')] = 'JOB_619';
    for (const [k, v] of Object.entries(over)) row[col(k)] = v;
    g.push(row);
  };
  add({ 'Source By': 'Shipra Tripathi (T28362)' });
  add({ 'Source By': 'Shipra Tripathi' });
  add({ 'Source By': 'Priya Jaswal (C0044)' });
  add({ 'Source By': 'Priya Jaswal (28753)' });
  add({ 'Source By': 'Darwinbox Admin (DB001)' });
  add({ 'Candidate Source Type': 'Referral', 'Candidate Source Name': 'Pallavi Negi' });
  add({ 'Candidate Source Type': 'Referral', 'Candidate Source Name': 'Nupur Ratra' });
  const r = createRuntime({ grids });
  r.publish();
  const ug = r.file('mu').businessUnits.find((b) => b.label === 'UG Programme').candidates;
  assert.equal(ug.byRecruiter['Shipra Tripathi'], 2);
  assert.equal(ug.byRecruiter['Priya Jaswal'], 2);
  assert.ok(ug.byRecruiter['Darwinbox Admin'] >= 1);
  assert.ok(!Object.keys(ug.byRecruiter).some((k) => /\(/.test(k)), 'an ID was left in a name');
  assert.ok(ug.bySource['Employee referral'] >= 2);
  assert.ok(!ug.bySource['Pallavi Negi'] && !ug.bySource['Nupur Ratra'], 'referrer name listed');
});

ok('column order can change (columns found by header name)', () => {
  const grids = makeSheetGrids();
  const rev = grids['Candidate Data'].map((row) => row.slice().reverse());
  const r = createRuntime({ grids: { Manpower: grids.Manpower, 'Candidate Data': rev } });
  r.publish();
  assert.equal(
    r.file('mu').businessUnits.reduce((a, b) => a + b.candidates.total, 0),
    mu.businessUnits.reduce((a, b) => a + b.candidates.total, 0)
  );
});

ok('dates in dd-mm-yyyy become weekly-chart days', () => {
  const days = Object.keys(mu.businessUnits.find((b) => b.label === 'UG Programme').candidates.byDay);
  assert.ok(days.length > 10);
  assert.ok(days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
});

// ---------- how it talks to GitHub ----------

ok('publishing again with the same numbers makes no commit (no needless website builds)', () => {
  const r = createRuntime();
  r.publish();
  const commits = r.state.github.commits.length;
  const stamp = r.file('mu').fetchedAt;
  r.state.now += 60 * 60 * 1000; // an hour later, nothing changed in the sheet
  const again = r.publish();
  assert.deepEqual(again.map((x) => x.result), ['unchanged', 'unchanged']);
  assert.equal(r.state.github.commits.length, commits);
  assert.equal(r.file('mu').fetchedAt, stamp, 'file was rewritten');
});

ok('a change in the sheet updates only the unit that changed', () => {
  const grids = makeSheetGrids();
  const r = createRuntime({ grids });
  r.publish();
  const before = r.state.github.commits.length;
  grids.Manpower.push(['JOB_700', 'UG Programme (UGP)', 'Admissions', 'Open', '4', '0', '0', '0', '0', '4', 'B']);
  r.state.now += 60 * 60 * 1000;
  const out = r.publish();
  assert.deepEqual(out.map((x) => `${x.unit}:${x.result}`), ['mu:updated', 'tetr:unchanged']);
  assert.equal(r.state.github.commits.length, before + 1);
  assert.ok(r.file('mu').jobs.some((j) => j.jobId === 'JOB_700'));
  assert.ok(new Date(r.file('mu').fetchedAt) > new Date(rt.file('mu').fetchedAt));
});

ok('a concurrent change on GitHub is handled with one retry', () => {
  const grids = makeSheetGrids();
  const r = createRuntime({ grids });
  r.publish();
  grids.Manpower.push(['JOB_702', 'UG Programme (UGP)', 'Admissions', 'Open', '3', '0', '0', '0', '0', '3', 'C']);
  r.state.now += 60 * 60 * 1000;

  // Someone else changes mu.json after we read it and before we save: our first save must be refused.
  let fired = 0;
  r.state.github.beforePut = (p) => {
    fired++;
    const f = r.state.github.files.get(p);
    const buf = Buffer.from(f.buf.toString('utf8').replace('"source":"sheet"', '"source":"sheet-edited-elsewhere"'));
    r.state.github.files.set(p, { buf, sha: 'sha-from-someone-elses-commit' });
  };
  r.state.github.calls.length = 0;
  const out = r.publish();

  assert.equal(fired, 1, 'the conflict was never simulated');
  const puts = r.state.github.calls.filter((c) => c.method === 'put' && c.url.includes('mu.json'));
  assert.equal(puts.length, 2, 'expected one refused save and one retry');
  assert.deepEqual(out.map((x) => `${x.unit}:${x.result}`), ['mu:updated', 'tetr:unchanged']);
  assert.ok(r.file('mu').jobs.some((j) => j.jobId === 'JOB_702'), 'retry did not save the new numbers');
  assert.equal(r.file('mu').source, 'sheet', 'our version should win after the retry');
});

ok('a conflict that keeps happening stops after one retry with a plain message', () => {
  const grids = makeSheetGrids();
  const r = createRuntime({ grids });
  r.publish();
  grids.Manpower.push(['JOB_703', 'UG Programme (UGP)', 'Admissions', 'Open', '1', '0', '0', '0', '0', '1', 'C']);
  r.state.now += 60 * 60 * 1000;
  const gh = r.state.github;
  const realFetch = r.ctx.UrlFetchApp.fetch;
  // every save is refused as a conflict
  r.ctx.UrlFetchApp.fetch = (url, opts = {}) =>
    String(opts.method).toLowerCase() === 'put'
      ? { getResponseCode: () => 409, getContentText: () => JSON.stringify({ message: 'conflict' }) }
      : realFetch(url, opts);
  gh.calls.length = 0;
  assert.throws(() => r.publish(), /409/);
  assert.equal(r.state.reads > 0, true);
});

ok('a missing token fails fast with a plain message, before reading the sheet', () => {
  const r = createRuntime({ props: { GITHUB_REPO: 'mastersunion/ta-dashboard' } });
  assert.throws(() => r.publish(), /GITHUB_TOKEN is not set/);
  assert.equal(r.state.reads, 0);
});

ok('a badly written repository name is explained', () => {
  const r = createRuntime({ props: { GITHUB_TOKEN: TOKEN, GITHUB_REPO: 'https://github.com/mastersunion/ta-dashboard' } });
  assert.throws(() => r.publish(), /owner\/name/);
});

ok('wrong or expired token: clear message, no token in it', () => {
  const r = createRuntime({ props: { GITHUB_TOKEN: 'github_pat_WRONG', GITHUB_REPO: 'mastersunion/ta-dashboard' } });
  let message = '';
  try { r.publish(); } catch (e) { message = e.message; }
  assert.match(message, /401/);
  assert.match(message, /expired/);
  assert.ok(!message.includes('github_pat_WRONG'));
});

ok('wrong repository: points at the repository name and token', () => {
  const r = createRuntime({ props: { GITHUB_TOKEN: TOKEN, GITHUB_REPO: 'mastersunion/does-not-exist' } });
  let message = '';
  try { r.publish(); } catch (e) { message = e.message; }
  assert.match(message, /404/);
  assert.match(message, /GITHUB_REPO/);
});

ok('the token never appears in logs or error text', () => {
  const r = createRuntime();
  r.publish();
  const bad = createRuntime({ props: { GITHUB_TOKEN: 'github_pat_WRONG', GITHUB_REPO: 'mastersunion/ta-dashboard' } });
  try { bad.publish(); } catch (e) { bad.state.logs.push(e.message); }
  for (const x of [r, bad]) {
    for (const line of x.state.logs) {
      assert.ok(!line.includes(TOKEN) && !line.includes('github_pat_WRONG'), `token in log: ${line}`);
    }
  }
});

ok('a sheet outage stops the publish and leaves the old files alone', () => {
  const r = createRuntime();
  r.publish();
  const snapshot = JSON.stringify(r.file('mu'));
  r.state.failReads = true;
  assert.throws(() => r.publish(), /Simulated Google outage/);
  assert.equal(JSON.stringify(r.file('mu')), snapshot);
});

ok('two publishes at once: the second is refused with a plain message', () => {
  const r = createRuntime();
  r.state.lockBusy = true;
  assert.throws(() => r.publish(), /already running/);
  assert.equal(r.state.reads, 0);
});

ok('menu: Publish now reports what happened, in plain words', () => {
  const r = createRuntime();
  r.ctx.onOpen();
  assert.equal(r.state.menu[0].name, 'TA Dashboard');
  assert.deepEqual(r.state.menu[0].items.map((i) => i[1]), ['publishFromMenu', 'dryRun', 'setupTrigger', 'removeTrigger']);
  r.ctx.publishFromMenu();
  assert.equal(r.state.alerts.at(-1).title, 'Published');
  assert.match(r.state.alerts.at(-1).text, /2 to 3 minutes/);
  r.ctx.publishFromMenu();
  assert.match(r.state.alerts.at(-1).text, /Nothing has changed/);
  const broken = createRuntime({ props: {} });
  broken.ctx.publishFromMenu();
  assert.equal(broken.state.alerts.at(-1).title, 'Could not publish');
  assert.match(broken.state.alerts.at(-1).text, /GITHUB_TOKEN/);
});

ok('hourly trigger: created once, replaced not duplicated, removable', () => {
  const r = createRuntime();
  r.ctx.setupTrigger();
  r.ctx.setupTrigger();
  assert.equal(r.state.triggers.length, 1);
  assert.equal(r.state.triggers[0].fn, 'publishNow');
  assert.equal(r.state.triggers[0].hours, 1);
  r.ctx.removeTrigger();
  assert.equal(r.state.triggers.length, 0);
});

ok('check-the-numbers does not call GitHub', () => {
  const r = createRuntime();
  r.ctx.dryRun();
  assert.equal(r.state.github.calls.length, 0);
  assert.ok(r.state.logs.some((l) => /MU: \d+ jobs/.test(l)) && r.state.logs.some((l) => /TETR: \d+ jobs/.test(l)));
});

console.log(`\n${passed} checks passed.`);
console.log(`MU: ${mu.jobs.length} jobs, ${mu.businessUnits.reduce((a, b) => a + b.candidates.total, 0)} candidates`);
console.log(`TETR: ${tetr.jobs.length} jobs, ${tetr.businessUnits.reduce((a, b) => a + b.candidates.total, 0)} candidates`);
console.log(`File sizes: mu.json ${(rt.state.github.files.get('public/data/mu.json').buf.length / 1024).toFixed(0)} KB, tetr.json ${(rt.state.github.files.get('public/data/tetr.json').buf.length / 1024).toFixed(0)} KB`);
