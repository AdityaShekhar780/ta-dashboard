/**
 * TA Dashboard publisher (Google Apps Script that lives in the "TA data" sheet).
 *
 * It reads the Manpower and Candidate Data tabs, works out the numbers for each payroll unit
 * and saves them as two small files in a GitHub repository:
 *   public/data/mu.json     Masters' Union
 *   public/data/tetr.json   TETR
 * GitHub then rebuilds the website and publishes it on Firebase Hosting.
 *
 * Only counts are published. Candidate names, emails and phone numbers are never read.
 *
 * Settings go in Project Settings > Script properties (never in this code):
 *   GITHUB_TOKEN   fine-grained token with "Contents: Read and write" on the ONE repository
 *   GITHUB_REPO    owner/name, for example mastersunion/ta-dashboard
 *   GITHUB_BRANCH  optional, defaults to main
 *
 * Use the "TA Dashboard" menu in the sheet to publish on demand or switch on hourly publishing.
 */

var MANPOWER_TAB = 'Manpower';
var CANDIDATE_TAB = 'Candidate Data';
var DATA_FOLDER = 'public/data';
var PUBLISH_EVERY_HOURS = 1;

// Payroll unit -> Business Unit. Matched on the FULL sheet name (spaces and capitals ignored).
// "PG Programme (PGP)" is MU and "TETR PG Programme (TETR_PG)" is TETR. Never match on part of a name.
var UNITS = {
  mu: {
    name: "Masters' Union",
    short: 'MU',
    businessUnits: [
      { sheetName: 'Central Functions (CF)', label: 'Central Functions' },
      { sheetName: 'PG Programme (PGP)', label: 'PG Programme' },
      { sheetName: 'PG Programme (Bharat) (PGP_B)', label: 'PG Programme (Bharat)' },
      { sheetName: 'UG Programme (UGP)', label: 'UG Programme' },
      { sheetName: 'Executive Education (Exec. Education)', label: 'Executive Education' }
    ]
  },
  tetr: {
    name: 'TETR',
    short: 'TETR',
    businessUnits: [
      { sheetName: 'TETR Central Function (TETR CF)', label: 'TETR Central Functions' },
      { sheetName: 'TETR UG Programme (TETR_UG)', label: 'TETR UG Programme' },
      { sheetName: 'TETR PG Programme (TETR_PG)', label: 'TETR PG Programme' },
      { sheetName: 'TETR Executive Programme (TETR_EE)', label: 'TETR Executive Programme' }
    ]
  }
};

// Jobs that must never appear anywhere (exact Job ID match, so JOB_100 is not affected).
var EXCLUDED_JOB_IDS = { job_10: true };

// Candidate Data columns that are read (matched by header name, so column order can change).
var CANDIDATE_COLUMNS = [
  'Date Of Application', 'Source By', 'Job Id', 'Job Name', 'Business Unit',
  'Candidate Source Name', 'Candidate Source Type', 'Pre-Offer Status', 'Candidate Status'
];

/* ---------- menu and triggers ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TA Dashboard')
    .addItem('Publish now', 'publishFromMenu')
    .addItem('Check the numbers (does not publish)', 'dryRun')
    .addSeparator()
    .addItem('Turn on automatic publishing (hourly)', 'setupTrigger')
    .addItem('Turn off automatic publishing', 'removeTrigger')
    .addToUi();
}

/** Menu wrapper: runs publishNow and tells the person what happened. */
function publishFromMenu() {
  var ui = SpreadsheetApp.getUi();
  try {
    var results = publishNow();
    var changed = results.filter(function (r) { return r.result !== 'unchanged'; }).length;
    ui.alert(
      'Published',
      changed
        ? 'The new numbers were sent to GitHub. The website updates in about 2 to 3 minutes.'
        : 'Nothing has changed since the last publish, so nothing was sent.',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Could not publish', String(err && err.message ? err.message : err), ui.ButtonSet.OK);
  }
}

function setupTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('publishNow').timeBased().everyHours(PUBLISH_EVERY_HOURS).create();
  toast_('Automatic publishing is on: every ' + PUBLISH_EVERY_HOURS + ' hour(s).');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'publishNow') ScriptApp.deleteTrigger(t);
  });
  toast_('Automatic publishing is off.');
}

function toast_(message) {
  try { SpreadsheetApp.getActive().toast(message, 'TA Dashboard', 5); } catch (err) { console.log(message); }
}

/* ---------- publishing ---------- */

/**
 * Reads the sheet and saves public/data/mu.json and public/data/tetr.json in the GitHub repository.
 * A file is only saved when its numbers changed, so quiet periods cause no new website builds.
 * Returns [{ unit, result }] where result is 'created', 'updated' or 'unchanged'.
 */
function publishNow() {
  var settings = githubSettings_(); // checked first so a missing setting fails fast
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another publish is already running. Try again in a minute.');
  try {
    var data = buildAll_(readManpower_(), readCandidates_());
    var stamp = new Date().toISOString();
    var results = [];
    Object.keys(UNITS).forEach(function (unitKey) {
      var u = data.units[unitKey];
      var payload = {
        unit: u.unit,
        businessUnits: u.businessUnits,
        jobs: u.jobs,
        checks: u.checks,
        fetchedAt: stamp,
        source: 'sheet'
      };
      var result = pushJson_(settings, DATA_FOLDER + '/' + unitKey + '.json', payload);
      console.log(unitKey + ': ' + result);
      results.push({ unit: unitKey, result: result });
    });
    return results;
  } finally {
    lock.releaseLock();
  }
}

/** Reads the sheet and logs the totals, without sending anything. Check View > Executions. */
function dryRun() {
  var data = buildAll_(readManpower_(), readCandidates_());
  var lines = [];
  Object.keys(data.units).forEach(function (k) {
    var u = data.units[k];
    var candidates = u.businessUnits.reduce(function (a, b) { return a + b.candidates.total; }, 0);
    lines.push(u.unit.short + ': ' + u.jobs.length + ' jobs, ' + candidates + ' candidates, ' + u.checks.length + ' data checks');
  });
  console.log(lines.join('\n'));
  toast_(lines.join('  |  '));
}

function githubSettings_() {
  var props = PropertiesService.getScriptProperties();
  var token = String(props.getProperty('GITHUB_TOKEN') || '').trim();
  var repo = String(props.getProperty('GITHUB_REPO') || '').trim();
  var branch = String(props.getProperty('GITHUB_BRANCH') || 'main').trim();
  if (!token) throw new Error('GITHUB_TOKEN is not set. Add it under Project Settings > Script properties.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error('GITHUB_REPO must look like owner/name, for example mastersunion/ta-dashboard.');
  }
  return { token: token, repo: repo, branch: branch };
}

function github_(s, method, path, body) {
  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + s.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ta-dashboard-apps-script'
    }
  };
  if (body) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + s.repo + path, options);
  var json = null;
  try { json = JSON.parse(res.getContentText()); } catch (err) { json = null; }
  return { status: res.getResponseCode(), json: json };
}

// Plain-language error that never includes the token.
function githubError_(r, action) {
  var detail = r.json && r.json.message ? ': ' + r.json.message : '';
  var hint = '';
  if (r.status === 401) hint = ' The token is wrong or has expired. Create a new one and update GITHUB_TOKEN.';
  else if (r.status === 403) hint = ' The token is not allowed to do this. It needs "Contents: Read and write" on the repository.';
  else if (r.status === 404) hint = ' Check the repository name in GITHUB_REPO and that the token was created for that repository.';
  return 'GitHub answered ' + r.status + detail + ' while ' + action + '.' + hint;
}

// True when the numbers in the saved file equal the new numbers (the publish time is ignored).
function sameData_(file, newText) {
  if (!file || !file.content || file.encoding !== 'base64') return false;
  try {
    var oldText = Utilities.newBlob(Utilities.base64Decode(String(file.content).replace(/\s/g, ''))).getDataAsString();
    var oldObj = JSON.parse(oldText);
    var newObj = JSON.parse(newText);
    delete oldObj.fetchedAt;
    delete newObj.fetchedAt;
    return JSON.stringify(oldObj) === JSON.stringify(newObj);
  } catch (err) {
    return false;
  }
}

function pushJson_(s, path, payload) {
  var text = JSON.stringify(payload);
  var encodedPath = path.split('/').map(encodeURIComponent).join('/');
  for (var attempt = 0; attempt < 2; attempt++) {
    var got = github_(s, 'get', '/contents/' + encodedPath + '?ref=' + encodeURIComponent(s.branch));
    var sha = null;
    if (got.status === 200 && got.json) {
      sha = got.json.sha;
      if (sameData_(got.json, text)) return 'unchanged';
    } else if (got.status !== 404) {
      throw new Error(githubError_(got, 'reading ' + path));
    }
    var put = github_(s, 'put', '/contents/' + encodedPath, {
      message: 'Update TA data: ' + path.split('/').pop(),
      content: Utilities.base64Encode(text, Utilities.Charset.UTF_8),
      branch: s.branch,
      sha: sha || undefined
    });
    if (put.status === 200 || put.status === 201) return sha ? 'updated' : 'created';
    // The file changed between reading and saving: read it again and retry once.
    if ((put.status === 409 || put.status === 422) && attempt === 0) continue;
    throw new Error(githubError_(put, 'saving ' + path));
  }
  throw new Error('Could not save ' + path + ' after retrying.');
}

/* ---------- reading the sheet ---------- */

function readManpower_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(MANPOWER_TAB);
  if (!sheet) throw new Error('Tab not found: ' + MANPOWER_TAB);
  var values = sheet.getDataRange().getDisplayValues();
  if (values.length === 0) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) if (headers[c]) obj[headers[c]] = values[r][c];
    rows.push(obj);
  }
  return rows;
}

function readCandidates_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANDIDATE_TAB);
  if (!sheet) throw new Error('Tab not found: ' + CANDIDATE_TAB);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var index = {};
  headerRow.forEach(function (h, i) { index[norm_(h)] = i; });

  var found = [];
  CANDIDATE_COLUMNS.forEach(function (name) {
    var i = index[norm_(name)];
    if (i === undefined) console.warn('Candidate Data is missing the column: ' + name);
    else found.push({ name: name, col: i + 1 });
  });

  var count = lastRow - 1;
  var columns = found.map(function (f) {
    return sheet.getRange(2, f.col, count, 1).getDisplayValues();
  });
  var rows = new Array(count);
  for (var r = 0; r < count; r++) {
    var obj = {};
    for (var c = 0; c < found.length; c++) obj[found[c].name] = columns[c][r][0];
    rows[r] = obj;
  }
  return rows;
}

/* ---------- aggregation ---------- */

function norm_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function text_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function num_(v) {
  var x = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  return isFinite(x) ? x : 0;
}

// "Shipra Jaiswal (29453)", "Shipra Tripathi (T28362)" or "Priya Jaswal (C0044)" -> the name only,
// so one person is not split into several rows because of different employee ID formats.
function recruiterName_(v) {
  return text_(v).replace(/\s*\([^)]*\)\s*$/, '') || 'Unassigned';
}

// "28-10-2026" or "28/10/2026" -> "2026-10-28" (also accepts "2026-10-28")
function isoDate_(v) {
  var s = text_(v);
  var m = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(s);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

function inc_(map, key, n) {
  map[key] = (map[key] || 0) + (n || 1);
}

function isExcludedJob_(jobId) {
  return EXCLUDED_JOB_IDS[norm_(jobId)] === true;
}

function emptyManpower_() {
  return { openRoles: 0, needToClose: 0, closedRoles: 0, total: 0, yetToOffer: 0, offered: 0, joined: 0, pending: 0, replacement: 0 };
}

function emptyCandidates_() {
  return { total: 0, byStatus: {}, bySourceType: {}, bySource: {}, byRecruiter: {}, byPreOffer: {}, byDay: {} };
}

function buildAll_(manpower, candidates) {
  var units = {};
  var buData = {};      // norm(sheet name) -> { entry, unitKey }
  Object.keys(UNITS).forEach(function (unitKey) {
    var unit = UNITS[unitKey];
    units[unitKey] = {
      unit: { key: unitKey, name: unit.name, short: unit.short },
      businessUnits: [],
      jobs: [],
      checks: []
    };
    unit.businessUnits.forEach(function (bu) {
      var entry = { label: bu.label, sheetName: bu.sheetName, manpower: emptyManpower_(), candidates: emptyCandidates_() };
      units[unitKey].businessUnits.push(entry);
      var k = norm_(bu.sheetName);
      if (buData[k]) throw new Error('Business Unit listed twice: ' + bu.sheetName);
      buData[k] = { entry: entry, unitKey: unitKey };
    });
  });

  // Role names come from the candidate data (Job Name per Job Id).
  var roleByJob = {};
  candidates.forEach(function (c) {
    var id = norm_(c['Job Id']);
    if (id && !roleByJob[id] && text_(c['Job Name'])) roleByJob[id] = text_(c['Job Name']);
  });

  manpower.forEach(function (row) {
    var jobId = text_(row['Job ID']);
    if (!jobId || isExcludedJob_(jobId)) return;
    var hit = buData[norm_(row['Business Unit'])];
    if (!hit) return; // blank or unrecognised Business Unit: not shown on either link
    var status = text_(row['Job Status']);

    var job = {
      jobId: jobId,
      role: roleByJob[norm_(jobId)] || '',
      category: text_(row['Category']),
      businessUnit: hit.entry.label,
      department: text_(row['Department']),
      status: status,
      total: num_(row['Total Positions']),
      replacement: num_(row['Replacement']),
      yetToOffer: num_(row['Yet to Offer']),
      offered: num_(row['Offered']),
      joined: num_(row['Joined']),
      pending: num_(row['Pending Positions'])
    };

    var m = hit.entry.manpower;
    var s = norm_(status);
    if (s === 'open') m.openRoles++;
    else if (s === 'need to close') m.needToClose++;
    else if (s === 'closed') m.closedRoles++;
    m.total += job.total;
    m.yetToOffer += job.yetToOffer;
    m.offered += job.offered;
    m.joined += job.joined;
    m.pending += job.pending;
    m.replacement += job.replacement;

    var target = units[hit.unitKey];
    target.jobs.push(job);
    if (job.pending !== Math.max(0, job.total - job.offered - job.joined)) {
      target.checks.push({ jobId: jobId, businessUnit: hit.entry.label, issue: 'Pending does not equal Total minus Offered minus Joined' });
    }
    if (job.yetToOffer > job.total) {
      target.checks.push({ jobId: jobId, businessUnit: hit.entry.label, issue: 'Yet to Offer is higher than Total Positions' });
    }
  });

  candidates.forEach(function (row) {
    if (isExcludedJob_(row['Job Id'])) return;
    var hit = buData[norm_(row['Business Unit'])];
    if (!hit) return;
    var c = hit.entry.candidates;
    c.total++;
    inc_(c.byStatus, text_(row['Candidate Status']) || 'Unknown');
    inc_(c.bySourceType, text_(row['Candidate Source Type']) || 'Unknown');
    // For referrals the source name is the employee who referred the candidate: group them,
    // so individual employees are not listed on an open page.
    var srcType = text_(row['Candidate Source Type']);
    inc_(c.bySource, norm_(srcType) === 'referral' ? 'Employee referral' : (text_(row['Candidate Source Name']) || 'Unknown'));
    inc_(c.byRecruiter, recruiterName_(row['Source By']));
    var pre = text_(row['Pre-Offer Status']);
    if (pre) inc_(c.byPreOffer, pre);
    var day = isoDate_(row['Date Of Application']);
    if (day) inc_(c.byDay, day);
  });

  Object.keys(units).forEach(function (k) {
    units[k].jobs.sort(function (a, b) {
      return (b.pending - a.pending) || (a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0);
    });
  });

  return { units: units };
}
