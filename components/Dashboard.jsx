'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const nf = new Intl.NumberFormat('en-IN');
const fmt = (n) => nf.format(n || 0);
const norm = (s) => String(s ?? '').trim().toLowerCase();

const STAGE_ORDER = [
  'shortlisting', 'screening', 'process ongoing', 'stage 1', 'stage 2', 'stage 3',
  'make offer', 'pending for offer', 'offer accepted and to be added to the pending list',
  'in the pending list', 'activated', 'on hold',
  'rejected in the process', 'withdrawn by candidate', 'withdrawn by employer',
  'offer rejected by the candidate', 'offer withdrawn', 'offer expired', 'offer dropped',
];

function sumManpower(bus) {
  const out = { openRoles: 0, needToClose: 0, closedRoles: 0, total: 0, yetToOffer: 0, offered: 0, joined: 0, pending: 0 };
  for (const b of bus) for (const k of Object.keys(out)) out[k] += b.manpower[k] || 0;
  return out;
}

function mergeMaps(bus, field) {
  const out = {};
  for (const b of bus) {
    for (const [k, v] of Object.entries(b.candidates[field] || {})) out[k] = (out[k] || 0) + v;
  }
  return out;
}

const byCount = (map) => Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

function byStage(map) {
  const rank = (label) => {
    const i = STAGE_ORDER.indexOf(norm(label));
    return i === -1 ? 100 : i;
  };
  return Object.entries(map).sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1]);
}

const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function niceCeil(n) {
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/* ---------- small chart pieces ---------- */

function Bars({ items, total, empty = 'No data yet' }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  const max = Math.max(...items.map(([, v]) => v), 1);
  return (
    <ul className="bars">
      {items.map(([label, value]) => (
        <li key={label} title={`${label}: ${fmt(value)}${total ? ` (${Math.round((value / total) * 100)}%)` : ''}`}>
          <span className="bar-label">{label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
          </span>
          <span className="bar-value">
            {fmt(value)}
            {total ? <em>{Math.round((value / total) * 100)}%</em> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WeeklyChart({ weeks }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 210, padL = 38, padR = 8, padT = 10, padB = 26;
  const max = niceCeil(Math.max(4, ...weeks.map((w) => w.count)));
  const plotH = H - padT - padB;
  const bw = (W - padL - padR) / weeks.length;
  const total = weeks.reduce((a, w) => a + w.count, 0);
  const active = hover === null ? null : weeks[hover];

  return (
    <div>
      <p className="chart-readout" aria-live="polite">
        {active
          ? `Week of ${shortDate(active.start)}: ${fmt(active.count)} applications${hover === weeks.length - 1 ? ' (so far)' : ''}`
          : `${fmt(total)} applications in the last ${weeks.length} weeks`}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Applications per week" className="weekly">
        {[0, max / 2, max].map((t) => {
          const y = padT + (1 - t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} className="grid" />
              <text x={padL - 6} y={y + 4} textAnchor="end" className="tick">{fmt(t)}</text>
            </g>
          );
        })}
        {weeks.map((w, i) => {
          const h = (w.count / max) * plotH;
          const x = padL + i * bw + bw * 0.18;
          const width = bw * 0.64;
          const y = padT + plotH - h;
          const r = Math.min(3, h);
          return (
            <g key={w.start}>
              {h > 0 && (
                <path
                  className={`wbar${hover === i ? ' on' : ''}`}
                  d={`M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${padT + plotH} H${x} Z`}
                />
              )}
              {i % 2 === (weeks.length - 1) % 2 && (
                <text x={x + width / 2} y={H - 8} textAnchor="middle" className="tick">{shortDate(w.start)}</text>
              )}
              <rect
                x={padL + i * bw} y={padT} width={bw} height={plotH + padB}
                fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`Week of ${shortDate(w.start)}: ${w.count} applications`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StatusBadge({ status }) {
  const key = norm(status);
  const cls = key === 'open' ? 'open' : key === 'closed' ? 'closed' : 'warn';
  return <span className={`badge ${cls}`}><i aria-hidden="true" />{status || '—'}</span>;
}

/* ---------- main ---------- */

export default function Dashboard({ unitKey, unitName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [bu, setBu] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const lastStamp = useRef('');

  const load = useCallback(
    async (refresh) => {
      setRefreshing(true);
      setNotice('');
      try {
        let res;
        try {
          res = await fetch(`/data/${unitKey}.json?t=${Date.now()}`, { cache: 'no-store' });
        } catch {
          throw new Error('Could not load the data. Check your internet connection and try again.');
        }
        if (res.status === 404) {
          throw new Error('No data has been published yet. In the TA data sheet, choose TA Dashboard > Publish now.');
        }
        if (!res.ok) throw new Error(`Could not load the data (error ${res.status}). Try again in a minute.`);
        let json;
        try {
          json = await res.json();
        } catch {
          throw new Error('The data file could not be read. Publish again from the TA data sheet.');
        }
        setData(json);
        setError('');
        if (refresh && lastStamp.current === json.fetchedAt) {
          setNotice('You already have the latest published data. New numbers appear after the sheet is published.');
        }
        lastStamp.current = json.fetchedAt;
      } catch (e) {
        setError(e.message || 'Something went wrong.');
      } finally {
        setRefreshing(false);
      }
    },
    [unitKey]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const scopeBUs = useMemo(
    () => (data ? data.businessUnits.filter((b) => bu === 'all' || b.label === bu) : []),
    [data, bu]
  );
  const kpi = useMemo(() => sumManpower(scopeBUs), [scopeBUs]);
  const allTotals = useMemo(() => (data ? sumManpower(data.businessUnits) : null), [data]);

  const cand = useMemo(() => {
    const total = scopeBUs.reduce((a, b) => a + b.candidates.total, 0);
    const byDay = mergeMaps(scopeBUs, 'byDay');
    const today = todayIST();
    const sinceWeek = addDays(today, -6);
    const sinceMonth = addDays(today, -29);
    let last7 = 0, last30 = 0;
    for (const [d, n] of Object.entries(byDay)) {
      if (d >= sinceWeek && d <= today) last7 += n;
      if (d >= sinceMonth && d <= today) last30 += n;
    }
    const thisMonday = mondayOf(today);
    const weeks = [];
    for (let i = 11; i >= 0; i--) weeks.push({ start: addDays(thisMonday, -7 * i), count: 0 });
    const idx = new Map(weeks.map((w, i) => [w.start, i]));
    for (const [d, n] of Object.entries(byDay)) {
      const i = idx.get(mondayOf(d));
      if (i !== undefined && d <= today) weeks[i].count += n;
    }
    return {
      total, last7, last30, weeks,
      stages: byStage(mergeMaps(scopeBUs, 'byStatus')),
      sourceTypes: byCount(mergeMaps(scopeBUs, 'bySourceType')),
      sources: byCount(mergeMaps(scopeBUs, 'bySource')).slice(0, 8),
      recruiters: byCount(mergeMaps(scopeBUs, 'byRecruiter')).slice(0, 10),
      preOffer: byCount(mergeMaps(scopeBUs, 'byPreOffer')),
    };
  }, [scopeBUs]);

  const jobs = useMemo(() => {
    if (!data) return [];
    const q = norm(search);
    return data.jobs.filter(
      (j) =>
        (bu === 'all' || j.businessUnit === bu) &&
        (status === 'all' || norm(j.status) === status) &&
        (!q || [j.jobId, j.role, j.department, j.businessUnit].some((v) => norm(v).includes(q)))
    );
  }, [data, bu, status, search]);

  const checks = useMemo(
    () => (data ? data.checks.filter((c) => bu === 'all' || c.businessUnit === bu) : []),
    [data, bu]
  );

  const updated = data
    ? new Date(data.fetchedAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      })
    : '';

  const visibleJobs = showAll ? jobs : jobs.slice(0, 40);

  return (
    <div className="page">
      <header className="top">
        <div className="top-inner">
          <div>
            <p className="kicker">Talent Acquisition</p>
            <h1>{unitName}</h1>
          </div>
          <div className="actions">
            {data && <span className="stamp">Data as of {updated} IST</span>}
            <button type="button" className="refresh" onClick={() => load(true)} disabled={refreshing}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={refreshing ? 'spin' : ''}>
                <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap">
        {error && (
          <div className="alert" role="alert">
            <strong>Could not load the dashboard.</strong> {error}
            <button type="button" onClick={() => load(false)}>Try again</button>
          </div>
        )}
        {notice && <div className="note" role="status">{notice}</div>}
        {data?.source === 'mock' && <div className="note">Showing generated sample data, not your sheet.</div>}
        {!data && !error && <p className="muted loading">Loading TA data…</p>}

        {data && (
          <>
            <nav className="chips" aria-label="Business Unit">
              {['all', ...data.businessUnits.map((b) => b.label)].map((label) => (
                <button
                  key={label}
                  type="button"
                  className={bu === label ? 'chip on' : 'chip'}
                  aria-pressed={bu === label}
                  onClick={() => { setBu(label); setShowAll(false); }}
                >
                  {label === 'all' ? 'All Business Units' : label}
                </button>
              ))}
            </nav>

            <section aria-label="Manpower summary" className="kpis">
              <div><span>Open roles</span><b>{fmt(kpi.openRoles)}</b>{kpi.needToClose > 0 && <small>{fmt(kpi.needToClose)} need to close</small>}</div>
              <div><span>Total positions</span><b>{fmt(kpi.total)}</b></div>
              <div><span>Yet to offer</span><b>{fmt(kpi.yetToOffer)}</b></div>
              <div><span>Offered</span><b>{fmt(kpi.offered)}</b></div>
              <div><span>Joined</span><b>{fmt(kpi.joined)}</b></div>
              <div className="hl"><span>Pending positions</span><b>{fmt(kpi.pending)}</b></div>
            </section>

            <section>
              <h2>Manpower by Business Unit</h2>
              <div className="table-scroll">
                <table className="bu-table">
                  <thead>
                    <tr>
                      <th>Business Unit</th>
                      <th className="n">Open roles</th>
                      <th className="n">Total positions</th>
                      <th className="n">Yet to offer</th>
                      <th className="n">Offered</th>
                      <th className="n">Joined</th>
                      <th className="n">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.businessUnits.map((b) => (
                      <tr key={b.label} className={bu === b.label ? 'sel' : ''}>
                        <td>
                          <button type="button" className="link" onClick={() => { setBu(bu === b.label ? 'all' : b.label); setShowAll(false); }}>
                            {b.label}
                          </button>
                        </td>
                        <td className="n">{fmt(b.manpower.openRoles)}</td>
                        <td className="n">{fmt(b.manpower.total)}</td>
                        <td className="n">{fmt(b.manpower.yetToOffer)}</td>
                        <td className="n">{fmt(b.manpower.offered)}</td>
                        <td className="n">{fmt(b.manpower.joined)}</td>
                        <td className="n">{fmt(b.manpower.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>All {unitName} Business Units</td>
                      <td className="n">{fmt(allTotals.openRoles)}</td>
                      <td className="n">{fmt(allTotals.total)}</td>
                      <td className="n">{fmt(allTotals.yetToOffer)}</td>
                      <td className="n">{fmt(allTotals.offered)}</td>
                      <td className="n">{fmt(allTotals.joined)}</td>
                      <td className="n">{fmt(allTotals.pending)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section>
              <h2>Candidate pipeline{bu !== 'all' ? ` · ${bu}` : ''}</h2>
              <div className="figs">
                <div><b>{fmt(cand.total)}</b><span>candidates in total</span></div>
                <div><b>{fmt(cand.last7)}</b><span>applied in the last 7 days</span></div>
                <div><b>{fmt(cand.last30)}</b><span>applied in the last 30 days</span></div>
              </div>
              <div className="grid2">
                <div className="panel">
                  <h3>Applications per week</h3>
                  <WeeklyChart weeks={cand.weeks} />
                </div>
                <div className="panel">
                  <h3>Candidates by stage</h3>
                  <Bars items={cand.stages} total={cand.total} />
                </div>
                <div className="panel">
                  <h3>Source type</h3>
                  <Bars items={cand.sourceTypes} total={cand.total} />
                </div>
                <div className="panel">
                  <h3>Top sources</h3>
                  <Bars items={cand.sources} />
                </div>
                <div className="panel">
                  <h3>Candidates sourced by recruiter</h3>
                  <Bars items={cand.recruiters} />
                </div>
                <div className="panel">
                  <h3>Pre-offer status</h3>
                  <Bars items={cand.preOffer} total={cand.preOffer.reduce((a, [, v]) => a + v, 0)} />
                </div>
              </div>
            </section>

            <section>
              <h2>Jobs</h2>
              <div className="filters">
                <input
                  type="search"
                  placeholder="Search Job ID, role or department"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
                  aria-label="Search jobs"
                />
                <select value={status} onChange={(e) => { setStatus(e.target.value); setShowAll(false); }} aria-label="Job status">
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="need to close">Need to close</option>
                  <option value="closed">Closed</option>
                </select>
                <span className="muted">{fmt(jobs.length)} jobs</span>
              </div>
              <div className="table-scroll">
                <table className="jobs">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Role</th>
                      <th>Cat.</th>
                      <th>Business Unit</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th className="n">Total</th>
                      <th className="n">Yet to offer</th>
                      <th className="n">Offered</th>
                      <th className="n">Joined</th>
                      <th className="n">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleJobs.map((j) => (
                      <tr key={j.jobId}>
                        <td className="mono">{j.jobId}</td>
                        <td>{j.role || '—'}</td>
                        <td>{j.category || '—'}</td>
                        <td>{j.businessUnit}</td>
                        <td>{j.department}</td>
                        <td><StatusBadge status={j.status} /></td>
                        <td className="n">{fmt(j.total)}</td>
                        <td className="n">{fmt(j.yetToOffer)}</td>
                        <td className="n">{fmt(j.offered)}</td>
                        <td className="n">{fmt(j.joined)}</td>
                        <td className="n strong">{fmt(j.pending)}</td>
                      </tr>
                    ))}
                    {jobs.length === 0 && (
                      <tr><td colSpan={11} className="muted center">No jobs match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {jobs.length > 40 && (
                <button type="button" className="more" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Show fewer jobs' : `Show all ${fmt(jobs.length)} jobs`}
                </button>
              )}
            </section>

            {checks.length > 0 && (
              <details className="checks">
                <summary>{checks.length} {checks.length === 1 ? 'row needs' : 'rows need'} a look in the sheet</summary>
                <ul>
                  {checks.map((c, i) => (
                    <li key={`${c.jobId}-${i}`}><span className="mono">{c.jobId}</span> · {c.businessUnit} · {c.issue}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>
    </div>
  );
}
