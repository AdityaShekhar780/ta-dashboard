// Runs the real apps-script/Code.gs in Node with stand-ins for the Google services and for
// GitHub, fed with generated sample data laid out like the real sheet (display values, extra
// personal-data columns included so we can prove they never come out).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateMock } from './mock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CODE = fs.readFileSync(path.join(here, '../apps-script/Code.gs'), 'utf8');

const MANPOWER_HEADERS = ['Job ID', 'Business Unit', 'Department', 'Job Status', 'Total Positions', 'Replacement', 'Yet to Offer', 'Offered', 'Joined', 'Pending Positions', 'Category'];
// Real layout: personal columns sit between the ones we need.
const CAND_HEADERS = [
  'Candidate Id', 'Date Of Application', 'Source By', 'Job Id', 'Job Name', 'Business Unit', 'Department',
  'Candidate Name', 'Gender', 'Candidate Email Id', 'Candidate Contact Number',
  'Candidate Source Name', 'Candidate Source Type', 'Pre-Offer Status', 'Candidate Status',
];

export function makeSheetGrids(mock = generateMock()) {
  const manpower = [MANPOWER_HEADERS, ...mock.manpower.map((r) => MANPOWER_HEADERS.map((h) => String(r[h] ?? '')))];
  const candidates = [
    CAND_HEADERS,
    ...mock.candidates.map((c, i) =>
      CAND_HEADERS.map((h) => {
        if (h === 'Candidate Name') return `Person Name ${i}`;
        if (h === 'Candidate Email Id') return `person${i}@example.com`;
        if (h === 'Candidate Contact Number') return `98${String(10000000 + i)}`;
        if (h === 'Gender') return '';
        return String(c[h] ?? '');
      })
    ),
  ];
  return { Manpower: manpower, 'Candidate Data': candidates };
}

// Git's own blob hash, so the fake behaves like GitHub's sha handling.
const blobSha = (buf) =>
  crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');

export const TOKEN = 'github_pat_TESTTOKEN_1234567890';
export const REPO = 'mastersunion/ta-dashboard';

export function createRuntime({
  grids = makeSheetGrids(),
  failReads = false,
  props = { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO, GITHUB_BRANCH: 'main' },
} = {}) {
  const state = {
    now: Date.now(),
    failReads,
    reads: 0,
    props: { ...props },
    logs: [],
    lockBusy: false,
    triggers: [],
    toasts: [],
    alerts: [],
    menu: [],
    github: {
      files: new Map(), // path -> { buf, sha }
      commits: [],
      calls: [],
      beforePut: null, // hook to simulate a concurrent change
      validToken: TOKEN,
      validRepo: REPO,
    },
  };

  const sheet = (name) => {
    const g = grids[name];
    if (!g) return null;
    return {
      getDataRange: () => ({ getDisplayValues: () => g.map((r) => r.slice()) }),
      getLastRow: () => g.length,
      getLastColumn: () => g[0].length,
      getRange: (r, c, nr, nc) => ({
        getDisplayValues: () => {
          if (state.failReads) throw new Error('Simulated Google outage');
          state.reads++;
          return g.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc));
        },
      }),
    };
  };

  const toSigned = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
  const fromSigned = (arr) => Buffer.from(arr.map((b) => b & 255));

  const reply = (status, obj) => ({
    getResponseCode: () => status,
    getContentText: () => JSON.stringify(obj),
  });

  const gh = state.github;
  const UrlFetchApp = {
    fetch(url, opts = {}) {
      gh.calls.push({ url, method: String(opts.method || 'get').toLowerCase() });
      const auth = (opts.headers || {}).Authorization;
      if (auth !== `Bearer ${gh.validToken}`) return reply(401, { message: 'Bad credentials' });
      const m = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]+)(\?.*)?$/.exec(url);
      if (!m) return reply(404, { message: 'Not Found' });
      if (m[1] !== gh.validRepo) return reply(404, { message: 'Not Found' });
      const filePath = decodeURIComponent(m[2]);
      const method = String(opts.method || 'get').toLowerCase();
      const file = gh.files.get(filePath);

      if (method === 'get') {
        if (!file) return reply(404, { message: 'Not Found' });
        const b64 = file.buf.toString('base64').replace(/(.{60})/g, '$1\n');
        return reply(200, { sha: file.sha, encoding: 'base64', content: b64 });
      }
      if (method === 'put') {
        const body = JSON.parse(opts.payload);
        if (gh.beforePut) { const hook = gh.beforePut; gh.beforePut = null; hook(filePath); }
        const current = gh.files.get(filePath);
        if (current && body.sha !== current.sha) return reply(409, { message: `${filePath} does not match ${current.sha}` });
        if (!current && body.sha) return reply(422, { message: 'sha was supplied, but the file does not exist' });
        const buf = Buffer.from(body.content, 'base64');
        gh.files.set(filePath, { buf, sha: blobSha(buf) });
        gh.commits.push({ path: filePath, message: body.message, branch: body.branch });
        return reply(current ? 200 : 201, { content: { path: filePath } });
      }
      return reply(405, { message: 'Method not allowed' });
    },
  };

  class FakeDate extends Date {
    constructor(...a) { a.length ? super(...a) : super(state.now); }
    static now() { return state.now; }
  }

  const ctx = {
    console: {
      log: (...a) => state.logs.push(a.join(' ')),
      warn: (...a) => state.logs.push(a.join(' ')),
      error: (...a) => state.logs.push(a.join(' ')),
    },
    Date: FakeDate,
    SpreadsheetApp: {
      getActive: () => ({ getSheetByName: sheet, toast: (m) => state.toasts.push(m) }),
      getUi: () => ({
        ButtonSet: { OK: 'OK' },
        createMenu: (name) => {
          const menu = { name, items: [] };
          const api = {
            addItem: (label, fn) => { menu.items.push([label, fn]); return api; },
            addSeparator: () => api,
            addToUi: () => state.menu.push(menu),
          };
          return api;
        },
        alert: (title, text) => state.alerts.push({ title, text }),
      }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in state.props ? state.props[k] : null) }) },
    LockService: {
      getScriptLock: () => ({ tryLock: () => !state.lockBusy, releaseLock() {} }),
    },
    ScriptApp: {
      newTrigger: (fn) => {
        const t = { fn, hours: null };
        const api = {
          timeBased: () => api,
          everyHours: (n) => { t.hours = n; return api; },
          create: () => { state.triggers.push(t); return t; },
        };
        return api;
      },
      getProjectTriggers: () => state.triggers.map((t) => ({ getHandlerFunction: () => t.fn, _t: t })),
      deleteTrigger: (h) => { state.triggers = state.triggers.filter((t) => t !== h._t); },
    },
    UrlFetchApp,
    Utilities: {
      Charset: { UTF_8: 'UTF-8' },
      base64Encode: (data) => (typeof data === 'string' ? Buffer.from(data, 'utf8') : fromSigned(data)).toString('base64'),
      base64Decode: (s) => toSigned(Buffer.from(s, 'base64')),
      newBlob: (x) => ({ getDataAsString: () => (typeof x === 'string' ? x : fromSigned(x).toString('utf8')) }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);

  const publish = () => JSON.parse(JSON.stringify(ctx.publishNow())); // plain objects from this realm
  const file = (unit) => {
    const f = gh.files.get(`public/data/${unit}.json`);
    return f ? JSON.parse(f.buf.toString('utf8')) : null;
  };
  return { publish, file, state, ctx };
}
