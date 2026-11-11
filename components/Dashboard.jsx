'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const nf = new Intl.NumberFormat('en-IN');
const fmt = (n) => nf.format(n || 0);
const norm = (s) => String(s ?? '').trim().toLowerCase();

const UNIT_META = {
  overall: { key: 'overall', label: 'Overall', title: 'Overall (Masters’ Union & TETR)' },
  mu: { key: 'mu', label: 'Masters’ Union', title: 'Masters’ Union' },
  tetr: { key: 'tetr', label: 'TETR', title: 'TETR' },
};

const METRIC_LABELS = {
  yetToOffer: 'Yet to Offer',
  offered: 'Offered',
  joined: 'Joined (Current Month)',
  momOffered: 'Offered (Monthly)',
  momJoined: 'Joined (Monthly)',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REC_CHANNEL_OPTIONS = [
  { key: 'all', label: 'Overall (All Channels)' },
  { key: 'internalGroup', label: 'Internal (Internal, Careers Page, Campus)' },
  { key: 'employeeReferral', label: 'Employee Referral' },
  { key: 'businessReference', label: 'Business Reference' },
  { key: 'external', label: 'External' },
];

function formatYearMonth(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  if (!m) return ym;
  const yr = m[1].slice(2);
  const idx = parseInt(m[2], 10) - 1;
  return `${MONTH_NAMES[idx] || m[2]} '${yr}`;
}

function sumManpower(bus) {
  const out = { openRoles: 0, needToClose: 0, closedRoles: 0, total: 0, yetToOffer: 0, offered: 0, joined: 0, pending: 0 };
  for (const b of bus) for (const k of Object.keys(out)) out[k] += b.manpower[k] || 0;
  return out;
}

const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

function toIsoDateStr(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s === '—' || s === '-') return null;

  let m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }

  m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, '0');
    const day = m[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, '0');
    const da = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }

  return null;
}

function isJoinedThisMonth(dateStr) {
  const iso = toIsoDateStr(dateStr);
  if (!iso) return false;
  const today = todayIST();
  const currentYearMonth = today.slice(0, 7);
  return iso.slice(0, 7) === currentYearMonth && iso <= today;
}

function matchesMetric(candidate, metricType) {
  if (metricType === 'momOffered' || metricType === 'momJoined') {
    return true;
  }

  const finalStat = norm(candidate.finalStatus);
  const rawStat = norm(candidate.status);
  const preStat = norm(candidate.preOfferStatus);
  const effectiveStat = finalStat || rawStat;

  if (metricType === 'joined') {
    const isJoinedStatus =
      effectiveStat.includes('join') ||
      effectiveStat.includes('activated') ||
      effectiveStat === 'active' ||
      rawStat.includes('activated');
    if (!isJoinedStatus) return false;
    return isJoinedThisMonth(candidate.joiningDate);
  }

  if (metricType === 'offered') {
    if (finalStat) {
      return (
        finalStat.includes('offer') &&
        !finalStat.includes('yet to offer') &&
        !finalStat.includes('pending for offer') &&
        !finalStat.includes('make offer') &&
        !finalStat.includes('join') &&
        !finalStat.includes('reject') &&
        !finalStat.includes('drop') &&
        !finalStat.includes('withdraw') &&
        !finalStat.includes('expir')
      );
    }
    return (
      (rawStat.includes('offer') || rawStat.includes('pending list')) &&
      !rawStat.includes('yet to offer') &&
      !rawStat.includes('pending for offer') &&
      !rawStat.includes('make offer') &&
      !rawStat.includes('join') &&
      !rawStat.includes('activated') &&
      !rawStat.includes('reject') &&
      !rawStat.includes('drop') &&
      !rawStat.includes('withdraw') &&
      !rawStat.includes('expir')
    );
  }

  if (metricType === 'yetToOffer') {
    const isYetToOfferFinal =
      finalStat === 'yet to offer' ||
      finalStat.includes('yet to offer') ||
      finalStat === 'pending for offer' ||
      finalStat === 'make offer';

    const isYetToOfferRaw =
      rawStat === 'yet to offer' ||
      rawStat.includes('yet to offer') ||
      rawStat === 'pending for offer' ||
      rawStat === 'make offer';

    const isYetToOfferPre =
      preStat === 'yet to offer' ||
      preStat.includes('yet to offer') ||
      preStat === 'pending for offer' ||
      preStat === 'make offer';

    if (finalStat) {
      return isYetToOfferFinal;
    }
    return isYetToOfferRaw || isYetToOfferPre;
  }

  return true;
}

/* ---------- Access Gate ---------- */

function AccessGate({ children }) {
  const [allowedUsers, setAllowedUsers] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAccess, setLoadingAccess] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('ta_dashboard_user');
    if (saved) {
      try { setCurrentUser(JSON.parse(saved)); } catch {}
    }

    fetch(`/data/access.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((json) => {
        setAllowedUsers(Array.isArray(json.users) ? json.users : []);
        setLoadingAccess(false);
      })
      .catch(() => {
        setAllowedUsers([]);
        setLoadingAccess(false);
      });
  }, []);

  const verifyEmail = useCallback((email) => {
    const cleanEmail = norm(email);
    if (!allowedUsers) return;

    const match = allowedUsers.find((u) => norm(u.email) === cleanEmail);
    if (match) {
      const userObj = { email: cleanEmail, name: match.name || cleanEmail };
      setCurrentUser(userObj);
      localStorage.setItem('ta_dashboard_user', JSON.stringify(userObj));
      setAuthError('');
    } else {
      setCurrentUser(null);
      localStorage.removeItem('ta_dashboard_user');
      setAuthError(`Access denied for "${cleanEmail}". Ask the TA admin to add your email to the "Access" tab.`);
    }
  }, [allowedUsers]);

  const isAuthorized = useMemo(() => {
    if (!currentUser || !allowedUsers) return false;
    return allowedUsers.some((u) => norm(u.email) === norm(currentUser.email));
  }, [currentUser, allowedUsers]);

  if (loadingAccess) {
    return <div className="page"><main className="wrap"><p className="muted loading">Checking access permissions…</p></main></div>;
  }

  if (!isAuthorized) {
    return (
      <div className="page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '430px', width: '100%', padding: '32px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)', textAlign: 'center' }}>
          <p className="kicker" style={{ marginBottom: '6px' }}>Talent Acquisition</p>
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Authorized Access Only</h1>
          <p className="muted" style={{ fontSize: '14px', marginBottom: '24px' }}>Enter your approved email address to view the dashboard.</p>
          <form onSubmit={(e) => { e.preventDefault(); verifyEmail(emailInput); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="email" required placeholder="Enter your work email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: '15px' }} />
            <button type="submit" style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #eab308', background: '#059669', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>Verify Access</button>
          </form>
          {authError && <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '13px' }}>{authError}</div>}
        </div>
      </div>
    );
  }

  return children({ currentUser, onSignOut: () => { localStorage.removeItem('ta_dashboard_user'); setCurrentUser(null); } });
}

/* ---------- Candidate Details Modal ---------- */

function CandidateModal({ modalData, onClose }) {
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  useEffect(() => {
    setShowAllCandidates(false);
  }, [modalData]);

  if (!modalData) return null;

  const { title, subtitle, candidates = [], metricType } = modalData;
  const filteredCandidates = candidates.filter((c) => matchesMetric(c, metricType));
  const listToShow = showAllCandidates ? candidates : filteredCandidates;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--modal-bg, #0f172a)', color: 'var(--text-color, #f8fafc)', border: '1px solid rgba(255, 255, 255, 0.18)', borderRadius: '12px', width: '100%', maxWidth: '1120px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {METRIC_LABELS[metricType] || 'Candidates'} ({filteredCandidates.length}) · {subtitle}
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: '18px' }}>{title}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {candidates.length > filteredCandidates.length && (
              <button type="button" onClick={() => setShowAllCandidates(!showAllCandidates)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'inherit', fontSize: '12px', cursor: 'pointer' }}>
                {showAllCandidates ? `Show ${METRIC_LABELS[metricType]} only (${filteredCandidates.length})` : `Show all (${candidates.length})`}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close modal" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'inherit', width: '34px', height: '34px', fontSize: '18px', cursor: 'pointer' }}>&times;</button>
          </div>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          {listToShow.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>No candidates match <b>{METRIC_LABELS[metricType]}</b> for this selection.</p>
          ) : (
            <div className="table-scroll">
              <table className="jobs" style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Role / Job</th>
                    <th>Candidate Name</th>
                    <th>Contact Number</th>
                    <th>Email ID</th>
                    <th>Status</th>
                    <th>Recruiter</th>
                    <th>Offer Date</th>
                    <th>Joining Date</th>
                    <th>Channel / Source</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {listToShow.map((c, idx) => (
                    <tr key={`${c.jobId || 'j'}-${c.email || c.name || 'cand'}-${idx}`}>
                      <td className="mono">{c.jobId || c.role || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{c.name || '—'}</td>
                      <td className="mono">{c.phone || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td><StatusBadge status={c.finalStatus || c.status} /></td>
                      <td>{c.recruiter || '—'}</td>
                      <td>{c.offerDate || '—'}</td>
                      <td>{c.joiningDate || '—'}</td>
                      <td>{[c.channel, c.source].filter((x) => x && x !== '—').join(' · ') || c.manager || '—'}</td>
                      <td>{c.department || c.businessUnit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Month-on-Month Line Chart ---------- */

function MomLineChart({ series, selectedBu, theme, onSelectPoint }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const chartData = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return [];
    return series.map((item) => {
      if (selectedBu === 'all') {
        return {
          month: item.month,
          label: formatYearMonth(item.month),
          offered: item.offered || 0,
          joined: item.joined || 0,
          offeredCandidates: item.offeredCandidates || [],
          joinedCandidates: item.joinedCandidates || [],
        };
      }
      const buStats = (item.byBu && item.byBu[selectedBu]) || { offered: 0, joined: 0 };
      return {
        month: item.month,
        label: formatYearMonth(item.month),
        offered: buStats.offered || 0,
        joined: buStats.joined || 0,
        offeredCandidates: (item.offeredCandidates || []).filter((c) => c.businessUnit === selectedBu),
        joinedCandidates: (item.joinedCandidates || []).filter((c) => c.businessUnit === selectedBu),
      };
    });
  }, [series, selectedBu]);

  const totals = useMemo(() => {
    let offered = 0;
    let joined = 0;
    for (const d of chartData) {
      offered += d.offered;
      joined += d.joined;
    }
    const ratio = offered > 0 ? Math.round((joined / offered) * 1000) / 10 : 0;
    return { offered, joined, ratio };
  }, [chartData]);

  if (!chartData.length) {
    return (
      <section className="panel" style={{ marginTop: '24px', padding: '20px', borderRadius: '12px', background: theme === 'light' ? '#fff' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(128,128,128,0.2)' }}>
        <h2 style={{ marginTop: 0 }}>Month-on-Month Offered vs. Joined</h2>
        <p className="muted">No historical/live MoM data found yet.</p>
      </section>
    );
  }

  const width = Math.max(960, chartData.length * 68);
  const height = 300;
  const padL = 46;
  const padR = 28;
  const padT = 36;
  const padB = 46;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(5, ...chartData.flatMap((d) => [d.offered, d.joined]));
  const yTicks = 5;
  const stepVal = Math.ceil(maxVal / yTicks);
  const yMax = stepVal * yTicks;

  const getX = (i) => (chartData.length === 1 ? padL + plotW / 2 : padL + (i / (chartData.length - 1)) * plotW);
  const getY = (val) => padT + plotH - (val / yMax) * plotH;

  const offeredPoints = chartData.map((d, i) => `${getX(i)},${getY(d.offered)}`).join(' ');
  const joinedPoints = chartData.map((d, i) => `${getX(i)},${getY(d.joined)}`).join(' ');

  const gridColor = theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.09)';
  const axisTextColor = theme === 'light' ? '#475569' : '#94a3b8';

  return (
    <section
      className="panel"
      style={{
        marginTop: '24px',
        padding: '22px',
        borderRadius: '12px',
        background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
        border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
        <div>
          <p className="kicker" style={{ marginBottom: '4px' }}>Offered & Joining Trend</p>
          <h2 style={{ margin: 0 }}>Month-on-Month Offered vs. Joined</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            {selectedBu === 'all' ? 'All Business Units' : selectedBu} · Click any dot to view candidates for that month
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#38bdf8', display: 'block', fontWeight: 600 }}>Total Offered</span>
            <strong style={{ fontSize: '18px', color: '#38bdf8' }}>{fmt(totals.offered)}</strong>
          </div>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#10b981', display: 'block', fontWeight: 600 }}>Total Joined</span>
            <strong style={{ fontSize: '18px', color: '#10b981' }}>{fmt(totals.joined)}</strong>
          </div>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#eab308', display: 'block', fontWeight: 600 }}>Joining Ratio</span>
            <strong style={{ fontSize: '18px', color: '#eab308' }}>{totals.ratio}%</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px', fontSize: '13px', fontWeight: 600 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: '#38bdf8' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
          Offered
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: '#10b981' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Joined
        </span>
      </div>

      <div className="table-scroll" style={{ width: '100%', overflowX: 'auto', paddingBottom: '6px' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, minWidth: `${width}px`, height: 'auto', display: 'block' }}>
          {Array.from({ length: yTicks + 1 }, (_, idx) => {
            const val = idx * stepVal;
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={gridColor} strokeDasharray={idx === 0 ? undefined : '4 4'} strokeWidth="1" />
                <text x={padL - 10} y={y + 4} textAnchor="end" fill={axisTextColor} fontSize="11">{val}</text>
              </g>
            );
          })}

          <polyline fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={offeredPoints} />
          <polyline fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={joinedPoints} />

          {chartData.map((d, i) => {
            const x = getX(i);
            const yOff = getY(d.offered);
            const yJoin = getY(d.joined);
            const isHovered = hoverIdx === i;

            return (
              <g key={d.month} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'pointer' }}>
                {isHovered && <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="rgba(234, 179, 8, 0.5)" strokeWidth="1.5" strokeDasharray="3 3" />}
                <text x={x} y={height - 14} textAnchor="middle" fill={isHovered ? '#eab308' : axisTextColor} fontSize="11" fontWeight={isHovered ? '700' : '500'}>{d.label}</text>

                <circle cx={x} cy={yOff} r={isHovered ? 6 : 4.5} fill="#38bdf8" stroke={theme === 'light' ? '#fff' : '#0f172a'} strokeWidth="2" onClick={() => d.offered > 0 && onSelectPoint(d.label, d.offeredCandidates, 'momOffered')} />
                {d.offered > 0 && (
                  <text x={x} y={yOff - 10} textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700" onClick={() => d.offered > 0 && onSelectPoint(d.label, d.offeredCandidates, 'momOffered')}>{d.offered}</text>
                )}

                <circle cx={x} cy={yJoin} r={isHovered ? 6 : 4.5} fill="#10b981" stroke={theme === 'light' ? '#fff' : '#0f172a'} strokeWidth="2" onClick={() => d.joined > 0 && onSelectPoint(d.label, d.joinedCandidates, 'momJoined')} />
                {d.joined > 0 && (
                  <text x={x} y={yJoin + 18} textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="700" onClick={() => d.joined > 0 && onSelectPoint(d.label, d.joinedCandidates, 'momJoined')}>{d.joined}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

/* ---------- Channel Analysis Section ---------- */

function ChannelAnalysisSection({ 
  channelBreakdown = {}, channelBreakdownByBu = {}, 
  currentChannelBreakdown = {}, currentChannelBreakdownByBu = {}, 
  channelEfficiencyOverall = {}, channelEfficiencyOverallByBu = {},
  channelEfficiencyMonthly = {}, channelEfficiencyMonthlyByBu = {},
  channelMomSeries = [], channelMomByBu = {}, 
  selectedBu, theme 
}) {
  
  const [effMode, setEffMode] = useState('overall');
  const [selectedMonth, setSelectedMonth] = useState('2026-03');

  const activeOverall = useMemo(() => {
    if (selectedBu === 'all') return channelBreakdown;
    return (channelBreakdownByBu && channelBreakdownByBu[selectedBu]) || {};
  }, [channelBreakdown, channelBreakdownByBu, selectedBu]);

  const activeCurrent = useMemo(() => {
    if (selectedBu === 'all') return currentChannelBreakdown;
    return (currentChannelBreakdownByBu && currentChannelBreakdownByBu[selectedBu]) || {};
  }, [currentChannelBreakdown, currentChannelBreakdownByBu, selectedBu]);

  const availableMonths = useMemo(() => {
    const rawMap = selectedBu === 'all' ? channelEfficiencyMonthly : (channelEfficiencyMonthlyByBu[selectedBu] || {});
    return Object.keys(rawMap).sort();
  }, [channelEfficiencyMonthly, channelEfficiencyMonthlyByBu, selectedBu]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, selectedMonth]);

  const activeEfficiencyList = useMemo(() => {
    const keys = ['Internal', 'Business Reference', 'Campus', 'Careers Page', 'Employee Referrals', 'External'];
    let rawData = {};
    if (effMode === 'overall') {
      rawData = selectedBu === 'all' ? channelEfficiencyOverall : (channelEfficiencyOverallByBu[selectedBu] || {});
    } else {
      const monthlyMap = selectedBu === 'all' ? channelEfficiencyMonthly : (channelEfficiencyMonthlyByBu[selectedBu] || {});
      rawData = monthlyMap[selectedMonth] || {};
    }

    return keys.map((ch) => {
      const stats = rawData[ch] || { applied: 0, joined: 0 };
      const applied = stats.applied || 0;
      const joined = stats.joined || 0;
      const rate = applied > 0 ? Math.round((joined / applied) * 1000) / 10 : 0;
      return { channel: ch, applied, joined, rate };
    }).sort((a, b) => b.rate - a.rate);
  }, [effMode, selectedBu, channelEfficiencyOverall, channelEfficiencyOverallByBu, channelEfficiencyMonthly, channelEfficiencyMonthlyByBu, selectedMonth]);

  const activeMomSeries = useMemo(() => {
    if (selectedBu === 'all') return channelMomSeries;
    return (channelMomByBu && channelMomByBu[selectedBu]) || [];
  }, [channelMomSeries, channelMomByBu, selectedBu]);

  const keys = ['Internal', 'Business Reference', 'Campus', 'Careers Page', 'Employee Referrals', 'External'];

  const overallList = useMemo(() => {
    const total = Object.values(activeOverall).reduce((a, b) => a + b, 0);
    return keys.map((ch) => {
      const count = activeOverall[ch] || 0;
      const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
      return { channel: ch, count, pct };
    }).sort((a, b) => b.count - a.count);
  }, [activeOverall]);

  const currentList = useMemo(() => {
    const total = Object.values(activeCurrent).reduce((a, b) => a + b, 0);
    return keys.map((ch) => {
      const count = activeCurrent[ch] || 0;
      const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
      return { channel: ch, count, pct };
    }).sort((a, b) => b.count - a.count);
  }, [activeCurrent]);

  const totalJoinings = useMemo(() => {
    return Object.values(activeOverall).reduce((a, b) => a + b, 0);
  }, [activeOverall]);

  const internalJoinings = useMemo(() => {
    return (activeOverall['Internal'] || 0) + 
           (activeOverall['Campus'] || 0) + 
           (activeOverall['Careers Page'] || 0) + 
           (activeOverall['Employee Referrals'] || 0);
  }, [activeOverall]);

  const internalContributionPct = useMemo(() => {
    if (totalJoinings === 0) return 0;
    return Math.round((internalJoinings / totalJoinings) * 1000) / 10;
  }, [internalJoinings, totalJoinings]);

  const colors = ['#38bdf8', '#34d399', '#facc15', '#a78bfa', '#fb923c', '#f472b6'];

  const width = Math.max(1100, activeMomSeries.length * 72);
  const height = 300;
  const padL = 46;
  const padR = 32;
  const padT = 36;
  const padB = 44;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(5, ...activeMomSeries.flatMap((d) => [d.internalGroup || 0, d.businessReference || 0, d.external || 0]));
  const yTicks = 4;
  const stepVal = Math.ceil(maxVal / yTicks);
  const yMax = stepVal * yTicks || 10;

  const getX = (i) => (activeMomSeries.length <= 1 ? padL + plotW / 2 : padL + (i / (activeMomSeries.length - 1)) * plotW);
  const getY = (val) => padT + plotH - (val / yMax) * plotH;

  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)';
  const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';
  const axisTextColor = theme === 'light' ? '#475569' : '#94a3b8';
  const gridColor = theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.08)';

  return (
    <section
      className="panel"
      style={{
        marginTop: '28px',
        padding: '24px',
        borderRadius: '12px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
        color: textColor,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '22px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Channel Analysis</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            {selectedBu === 'all' ? 'All Business Units' : selectedBu} · Joining distribution & conversion efficiency
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#38bdf8', display: 'block', fontWeight: 600 }}>Total Joinings</span>
            <strong style={{ fontSize: '18px', color: '#38bdf8' }}>{fmt(totalJoinings)}</strong>
          </div>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#10b981', display: 'block', fontWeight: 600 }}>Internal Joinings</span>
            <strong style={{ fontSize: '18px', color: '#10b981' }}>{fmt(internalJoinings)}</strong>
          </div>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#eab308', display: 'block', fontWeight: 600 }}>Internal Contr.</span>
            <strong style={{ fontSize: '18px', color: '#eab308' }}>{internalContributionPct}%</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(270px, 1fr) minmax(270px, 1fr) minmax(390px, 1.6fr)', gap: '20px', alignItems: 'stretch', width: '100%' }}>
        
        {/* Card 1: Overall Joinings by Channel */}
        <div
          style={{
            padding: '18px',
            borderRadius: '10px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(0,0,0,0.22)',
            border: `1px solid ${borderColor}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Overall Joinings by Channel</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {overallList.map((item, idx) => {
                const barColor = colors[idx % colors.length];
                return (
                  <div key={item.channel} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 500, gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: barColor, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.channel}</span>
                      </span>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <b>{fmt(item.count)}</b> <span style={{ color: axisTextColor, fontSize: '11px' }}>({item.pct}%)</span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Current Month Channel View */}
        <div
          style={{
            padding: '18px',
            borderRadius: '10px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(0,0,0,0.22)',
            border: `1px solid ${borderColor}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Current Month Channel View</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {currentList.map((item, idx) => {
                const barColor = colors[idx % colors.length];
                return (
                  <div key={item.channel} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 500, gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: barColor, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.channel}</span>
                      </span>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <b>{fmt(item.count)}</b> <span style={{ color: axisTextColor, fontSize: '11px' }}>({item.pct}%)</span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 3: Wider Channel Conversion Efficiency Card */}
        <div
          style={{
            padding: '18px',
            borderRadius: '10px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(0,0,0,0.22)',
            border: `1px solid ${borderColor}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Channel Conversion Efficiency</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select 
                  value={effMode} 
                  onChange={(e) => setEffMode(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '6px', background: theme === 'light' ? '#fff' : 'rgba(255,255,255,0.1)', color: 'inherit', border: `1px solid ${borderColor}`, fontSize: '11px', cursor: 'pointer' }}
                >
                  <option value="overall" style={{ background: '#0f172a', color: '#fff' }}>Overall</option>
                  <option value="monthly" style={{ background: '#0f172a', color: '#fff' }}>Monthly</option>
                </select>

                {effMode === 'monthly' && availableMonths.length > 0 && (
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '6px', background: theme === 'light' ? '#fff' : 'rgba(255,255,255,0.1)', color: 'inherit', border: `1px solid ${borderColor}`, fontSize: '11px', cursor: 'pointer' }}
                  >
                    {availableMonths.map((ym) => (
                      <option key={ym} value={ym} style={{ background: '#0f172a', color: '#fff' }}>
                        {formatYearMonth(ym)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeEfficiencyList.map((item, idx) => {
                const barColor = colors[idx % colors.length];
                return (
                  <div key={item.channel} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 500, gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: barColor, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.channel}</span>
                      </span>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '11px', color: axisTextColor }}>
                        <b>{fmt(item.joined)}</b> joined / {fmt(item.applied)} apps (<strong style={{ color: '#38bdf8' }}>{item.rate}%</strong>)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, item.rate * 2)}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 4: MoM Grouped Channel Trend */}
        <div
          style={{
            padding: '18px',
            borderRadius: '10px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(0,0,0,0.22)',
            border: `1px solid ${borderColor}`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gridColumn: '1 / -1',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>MoM Grouped Channel Trend</h3>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                Internal Group
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#34d399' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                Business Ref.
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fb923c' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#fb923c', display: 'inline-block' }} />
                External
              </span>
            </div>
          </div>

          {activeMomSeries.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '50px 0' }}>No channel trend data available for this Business Unit.</p>
          ) : (
            <div className="table-scroll" style={{ width: '100%', maxWidth: '100%', overflowX: 'scroll', paddingBottom: '10px' }}>
              <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, minWidth: `${width}px`, height: 'auto', display: 'block' }}>
                {Array.from({ length: yTicks + 1 }, (_, idx) => {
                  const val = idx * stepVal;
                  const y = getY(val);
                  return (
                    <g key={idx}>
                      <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={gridColor} strokeDasharray={idx === 0 ? undefined : '4 4'} strokeWidth="1" />
                      <text x={padL - 10} y={y + 4} textAnchor="end" fill={axisTextColor} fontSize="11">{val}</text>
                    </g>
                  );
                })}

                {activeMomSeries.map((d, i) => {
                  const x = getX(i);
                  const yInt = getY(d.internalGroup || 0);
                  const yBus = getY(d.businessReference || 0);
                  const yExt = getY(d.external || 0);

                  const nextD = activeMomSeries[i + 1];
                  const hasNext = nextD !== undefined;
                  const nextX = hasNext ? getX(i + 1) : 0;
                  const nextYInt = hasNext ? getY(nextD.internalGroup || 0) : 0;
                  const nextYBus = hasNext ? getY(nextD.businessReference || 0) : 0;
                  const nextYExt = hasNext ? getY(nextD.external || 0) : 0;

                  return (
                    <g key={d.month}>
                      {hasNext && (
                        <>
                          <line x1={x} y1={yInt} x2={nextX} y2={nextYInt} stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                          <line x1={x} y1={yBus} x2={nextX} y2={nextYBus} stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
                          <line x1={x} y1={yExt} x2={nextX} y2={nextYExt} stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" />
                        </>
                      )}

                      <text x={x} y={height - 12} textAnchor="middle" fill={axisTextColor} fontSize="11" fontWeight="500">
                        {formatYearMonth(d.month)}
                      </text>

                      <circle cx={x} cy={yInt} r={4} fill="#38bdf8" stroke={theme === 'light' ? '#fff' : '#0f172a'} strokeWidth="1.5" />
                      {d.internalGroup > 0 && (
                        <text x={x} y={yInt - 9} textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="700">
                          {d.internalGroup}
                        </text>
                      )}

                      <circle cx={x} cy={yBus} r={4} fill="#34d399" stroke={theme === 'light' ? '#fff' : '#0f172a'} strokeWidth="1.5" />
                      {d.businessReference > 0 && (
                        <text x={x} y={yBus - 9} textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="700">
                          {d.businessReference}
                        </text>
                      )}

                      <circle cx={x} cy={yExt} r={4} fill="#fb923c" stroke={theme === 'light' ? '#fff' : '#0f172a'} strokeWidth="1.5" />
                      {d.external > 0 && (
                        <text x={x} y={yExt + 16} textAnchor="middle" fill="#fb923c" fontSize="10" fontWeight="700">
                          {d.external}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

/* ---------- Recruiter Performance Section (With Channel Dropdown & Direct Master Offered Totals) ---------- */

function RecruiterPerformanceSection({
  recruiterPerformance,
  recruiterPerformanceByBu = {},
  selectedBu,
  theme
}) {
  const [viewScope, setViewScope] = useState('qtd'); // 'qtd' | 'overall'
  const [channelScope, setChannelScope] = useState('all'); // 'all' | 'internalGroup' | 'employeeReferral' | 'businessReference' | 'external'

  const activePerf = useMemo(() => {
    if (selectedBu !== 'all' && recruiterPerformanceByBu && recruiterPerformanceByBu[selectedBu]) {
      return recruiterPerformanceByBu[selectedBu];
    }
    return recruiterPerformance || {
      months: [],
      quarterMonths: [],
      monthlyRoiTarget: 10,
      quarterlyRoiTarget: 30,
      overallRoiTarget: 10,
      sheetTotals: {},
      recruiters: []
    };
  }, [recruiterPerformance, recruiterPerformanceByBu, selectedBu]);

  const displayedMonths = useMemo(() => {
    if (viewScope === 'qtd') {
      return activePerf.quarterMonths || [];
    }
    return activePerf.months || [];
  }, [viewScope, activePerf]);

  const monthlyRoiTarget = activePerf.monthlyRoiTarget || 10;
  // Quarterly ROI target is Monthly Target * 3 (10x * 3 = 30x)
  const periodRoiTarget = useMemo(() => {
    if (viewScope === 'qtd') {
      return activePerf.quarterlyRoiTarget || monthlyRoiTarget * 3;
    }
    return activePerf.overallRoiTarget || monthlyRoiTarget * Math.max(1, displayedMonths.length);
  }, [viewScope, activePerf, monthlyRoiTarget, displayedMonths.length]);

  const groupedRecruiters = useMemo(() => {
    const list = Array.isArray(activePerf.recruiters) ? activePerf.recruiters : [];
    const lateral = list.filter((r) => norm(r.hiringType) !== 'bulk');
    const bulk = list.filter((r) => norm(r.hiringType) === 'bulk');
    return [
      { key: 'Lateral', label: 'Lateral Hiring Recruiters', color: '#38bdf8', items: lateral },
      { key: 'Bulk', label: 'Bulk Hiring Recruiters', color: '#a78bfa', items: bulk },
    ].filter((g) => g.items.length > 0);
  }, [activePerf]);

  // Helper to resolve the active channel node for a recruiter
  const getRecChannelData = useCallback((r) => {
    if (channelScope !== 'all' && r.byChannel && r.byChannel[channelScope]) {
      return r.byChannel[channelScope];
    }
    if (r.byChannel && r.byChannel.all) {
      return r.byChannel.all;
    }
    return r;
  }, [channelScope]);

  // Helper to get scaled target for a recruiter (Monthly Target * 3 for QTD)
  const getRecruiterPeriodTarget = useCallback((r) => {
    const mTarget = Number(r.monthlyTarget ?? r.target ?? 0);
    if (viewScope === 'qtd') {
      return Number(r.quarterlyTarget ?? mTarget * 3);
    }
    return Number(r.overallTarget ?? mTarget * Math.max(1, displayedMonths.length));
  }, [viewScope, displayedMonths.length]);

  // Resolve active sheetTotals bucket for the selected channel filter
  const activeSheetTotals = useMemo(() => {
    const st = activePerf.sheetTotals || {};
    if (channelScope !== 'all' && st.byChannel && st.byChannel[channelScope]) {
      return st.byChannel[channelScope];
    }
    if (st.byChannel && st.byChannel.all) {
      return st.byChannel.all;
    }
    return st;
  }, [activePerf, channelScope]);

  const summaryKpis = useMemo(() => {
    const list = Array.isArray(activePerf.recruiters) ? activePerf.recruiters : [];
    let totalTarget = 0;
    let sumRecOffered = 0;
    let sumRecJoined = 0;
    let metTargetCount = 0;

    list.forEach((r) => {
      const chNode = getRecChannelData(r);
      const bucket = viewScope === 'qtd' ? (chNode.qtd || {}) : (chNode.overall || {});
      totalTarget += getRecruiterPeriodTarget(r);
      sumRecOffered += bucket.offered || 0;
      sumRecJoined += bucket.joined || 0;
      if ((bucket.roi || 0) >= periodRoiTarget) metTargetCount++;
    });

    // Pull Grand Totals directly from Master Offered sheetTotals (so departed Oct recruiters are included)
    const directPeriod = viewScope === 'qtd' ? activeSheetTotals.qtd : activeSheetTotals.overall;
    const totalOffered = directPeriod && typeof directPeriod.offered === 'number' ? directPeriod.offered : sumRecOffered;
    const totalJoined = directPeriod && typeof directPeriod.joined === 'number' ? directPeriod.joined : sumRecJoined;

    const unlistedPeriod = viewScope === 'qtd' ? activeSheetTotals.unlistedQtd : activeSheetTotals.unlistedOverall;
    const unlistedOffered = unlistedPeriod ? (unlistedPeriod.offered || 0) : Math.max(0, totalOffered - sumRecOffered);
    const unlistedJoined = unlistedPeriod ? (unlistedPeriod.joined || 0) : Math.max(0, totalJoined - sumRecJoined);

    return {
      totalTarget,
      totalOffered,
      totalJoined,
      unlistedOffered,
      unlistedJoined,
      metTargetCount,
      totalRecruiters: list.length
    };
  }, [activePerf, viewScope, periodRoiTarget, getRecChannelData, getRecruiterPeriodTarget, activeSheetTotals]);

  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)';
  const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';
  const mutedColor = theme === 'light' ? '#475569' : '#94a3b8';

  const renderRoiBadge = (roiVal, targetBench) => {
    const val = Number(roiVal) || 0;
    const isMet = val >= targetBench;
    const isMid = val >= targetBench * 0.5 && val < targetBench;
    const bg = isMet
      ? 'rgba(16, 185, 129, 0.16)'
      : isMid
      ? 'rgba(234, 179, 8, 0.16)'
      : 'rgba(148, 163, 184, 0.14)';
    const border = isMet ? '#10b981' : isMid ? '#eab308' : 'rgba(148, 163, 184, 0.35)';
    const color = isMet ? '#10b981' : isMid ? '#eab308' : mutedColor;

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '999px',
          background: bg,
          border: `1px solid ${border}`,
          color,
          fontWeight: 700,
          fontSize: '12px',
        }}
      >
        {val.toFixed(1)}x
      </span>
    );
  };

  const selectedChannelLabel = useMemo(() => {
    const hit = REC_CHANNEL_OPTIONS.find((o) => o.key === channelScope);
    return hit ? hit.label : 'Overall (All Channels)';
  }, [channelScope]);

  return (
    <section
      className="panel"
      style={{
        marginTop: '28px',
        padding: '24px',
        borderRadius: '12px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
        color: textColor,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
        <div>
          <p className="kicker" style={{ marginBottom: '4px' }}>Recruiter Efficiency & ROI</p>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Recruiter Performance</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            {selectedBu === 'all' ? 'All Business Units' : selectedBu} · {selectedChannelLabel} · Monthly Target: {monthlyRoiTarget}x ROI · Quarterly Target (×3): {monthlyRoiTarget * 3}x ROI
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Master Offered / Joined KPI Card */}
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#38bdf8', display: 'block', fontWeight: 600 }}>
              {viewScope === 'qtd' ? 'QTD Master Offered / Joined' : 'Overall Master Offered / Joined'}
            </span>
            <strong style={{ fontSize: '17px', color: '#38bdf8' }}>
              {fmt(summaryKpis.totalOffered)} / {fmt(summaryKpis.totalJoined)}
            </strong>
          </div>

          {/* ROI Target Achieved Card */}
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#eab308', display: 'block', fontWeight: 600 }}>
              ≥ {periodRoiTarget}x ROI Achieved
            </span>
            <strong style={{ fontSize: '17px', color: '#eab308' }}>
              {summaryKpis.metTargetCount} / {summaryKpis.totalRecruiters}
            </strong>
          </div>

          {/* Channel Dropdown Filter */}
          <select
            value={channelScope}
            onChange={(e) => setChannelScope(e.target.value)}
            aria-label="Filter Recruiter Performance by Channel"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.08)',
              color: 'inherit',
              border: '1px solid #38bdf8',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {REC_CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} style={{ background: '#0f172a', color: '#fff' }}>
                Channel: {opt.label}
              </option>
            ))}
          </select>

          {/* Period Dropdown Filter (QTD vs Overall) */}
          <select
            value={viewScope}
            onChange={(e) => setViewScope(e.target.value)}
            aria-label="Recruiter performance period"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.08)',
              color: 'inherit',
              border: '1px solid #eab308',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="qtd" style={{ background: '#0f172a', color: '#fff' }}>Current Quarter (QTD · Target ×3)</option>
            <option value="overall" style={{ background: '#0f172a', color: '#fff' }}>Overall (MoM Matrix)</option>
          </select>
        </div>
      </div>

      {/* ROI Weighting Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          padding: '10px 14px',
          marginBottom: '16px',
          borderRadius: '8px',
          background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${borderColor}`,
          fontSize: '12px',
          color: mutedColor,
        }}
      >
        <strong style={{ color: textColor }}>ROI Channel Weights (Fulltime & Contract):</strong>
        <span><b style={{ color: '#10b981' }}>100%</b> Internal (Internal, Careers Page, Campus)</span>
        <span><b style={{ color: '#eab308' }}>20%</b> Employee Referral · Business Reference</span>
        <span><b style={{ color: '#f87171' }}>0%</b> External & Interns</span>
        <span style={{ marginLeft: 'auto' }}>
          Monthly Baseline: <b>{monthlyRoiTarget}x</b> · Quarterly Baseline (×3): <b>{monthlyRoiTarget * 3}x</b>
        </span>
      </div>

      {groupedRecruiters.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
          No recruiters found. Make sure the <b>Recruiters</b> tab is populated and published from the sheet.
        </p>
      ) : (
        <div className="table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
          <table className="jobs" style={{ margin: 0, width: '100%', minWidth: `${Math.max(920, 560 + displayedMonths.length * 125)}px` }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: theme === 'light' ? '#e2e8f0' : '#1e293b' }}>Recruiter Name</th>
                <th>Hiring Type</th>
                <th className="n">
                  {viewScope === 'qtd' ? 'Qtr Target (×3)' : 'Target (Joinings)'}
                  <div style={{ fontSize: '10px', fontWeight: 500, opacity: 0.75 }}>Monthly × {viewScope === 'qtd' ? 3 : displayedMonths.length}</div>
                </th>
                {displayedMonths.map((ym) => (
                  <th key={ym} className="n" style={{ minWidth: '115px' }}>
                    {formatYearMonth(ym)}
                    <div style={{ fontSize: '10px', fontWeight: 500, opacity: 0.75 }}>Off / Join · ROI (10x)</div>
                  </th>
                ))}
                <th className="n">
                  {viewScope === 'qtd' ? 'QTD (Off / Join)' : 'Total (Off / Join)'}
                </th>
                <th className="n">Target Attainment</th>
                <th className="n">{viewScope === 'qtd' ? 'QTD ROI (30x)' : `Overall ROI (${periodRoiTarget}x)`}</th>
                <th className="n">{periodRoiTarget}x Target Status</th>
              </tr>
            </thead>
            <tbody>
              {groupedRecruiters.map((group) => {
                let groupTarget = 0;
                let groupOffered = 0;
                let groupJoined = 0;

                return (
                  <Fragment key={group.key}>
                    <tr>
                      <td
                        colSpan={7 + displayedMonths.length}
                        style={{
                          background: theme === 'light' ? '#f1f5f9' : 'rgba(56, 189, 248, 0.08)',
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: group.color,
                          padding: '9px 14px',
                        }}
                      >
                        {group.label} ({group.items.length})
                      </td>
                    </tr>

                    {group.items.map((r) => {
                      const chNode = getRecChannelData(r);
                      const periodStats = viewScope === 'qtd' ? (chNode.qtd || {}) : (chNode.overall || {});
                      const offered = periodStats.offered || 0;
                      const joined = periodStats.joined || 0;
                      const roi = Number(periodStats.roi) || 0;
                      const monthlyTarget = Number(r.monthlyTarget ?? r.target ?? 0);
                      const target = getRecruiterPeriodTarget(r);
                      const attainmentPct = target > 0 ? Math.round((joined / target) * 100) : 0;
                      const roiGap = Math.max(0, Math.round((periodRoiTarget - roi) * 10) / 10);

                      groupTarget += target;
                      groupOffered += offered;
                      groupJoined += joined;

                      return (
                        <tr key={`${group.key}-${r.name}`}>
                          <td
                            style={{
                              fontWeight: 600,
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              background: theme === 'light' ? '#ffffff' : '#0f172a',
                            }}
                          >
                            {r.name}
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: r.hiringType === 'Bulk' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                color: r.hiringType === 'Bulk' ? '#a78bfa' : '#38bdf8',
                              }}
                            >
                              {r.hiringType}
                            </span>
                          </td>
                          <td className="n" style={{ fontWeight: 600 }}>
                            {target > 0 ? (
                              <div>
                                <span>{fmt(target)}</span>
                                <span style={{ display: 'block', fontSize: '10px', color: mutedColor }}>
                                  ({fmt(monthlyTarget)}/mo)
                                </span>
                              </div>
                            ) : '—'}
                          </td>

                          {displayedMonths.map((ym) => {
                            const mStat = (chNode.byMonth && chNode.byMonth[ym]) || { offered: 0, joined: 0, roi: 0 };
                            const mOff = mStat.offered || 0;
                            const mJoin = mStat.joined || 0;
                            const mRoi = Number(mStat.roi) || 0;

                            return (
                              <td key={ym} className="n" style={{ whiteSpace: 'nowrap' }}>
                                {mOff === 0 && mJoin === 0 ? (
                                  <span style={{ color: mutedColor, opacity: 0.45 }}>—</span>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <span>
                                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>{fmt(mOff)}</span>
                                      {' / '}
                                      <strong style={{ color: '#10b981' }}>{fmt(mJoin)}</strong>
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: mRoi >= monthlyRoiTarget ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.07)',
                                        color: mRoi >= monthlyRoiTarget ? '#10b981' : mutedColor,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {mRoi.toFixed(1)}x
                                    </span>
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          <td className="n" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#38bdf8' }}>{fmt(offered)}</span>
                            {' / '}
                            <span style={{ color: '#10b981' }}>{fmt(joined)}</span>
                          </td>

                          <td className="n">
                            {target > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                                  {fmt(joined)} / {fmt(target)} ({attainmentPct}%)
                                </span>
                                <div style={{ width: '80px', height: '5px', background: 'rgba(148,163,184,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${Math.min(100, attainmentPct)}%`,
                                      height: '100%',
                                      background: attainmentPct >= 100 ? '#10b981' : '#38bdf8',
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="n">{renderRoiBadge(roi, periodRoiTarget)}</td>

                          <td className="n" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {roi >= periodRoiTarget ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Achieved ({roi.toFixed(1)}x)</span>
                            ) : (
                              <span style={{ color: '#eab308', fontWeight: 500 }}>Needs +{roiGap.toFixed(1)}x to {periodRoiTarget}x</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Subtotal Row per Hiring Type */}
                    <tr style={{ fontWeight: 700, background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.02)' }}>
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: theme === 'light' ? '#f8fafc' : '#162032',
                        }}
                      >
                        Subtotal · {group.key}
                      </td>
                      <td>—</td>
                      <td className="n">{fmt(groupTarget)}</td>
                      {displayedMonths.map((ym) => {
                        let mOffSum = 0;
                        let mJoinSum = 0;
                        group.items.forEach((r) => {
                          const chNode = getRecChannelData(r);
                          const ms = (chNode.byMonth && chNode.byMonth[ym]) || { offered: 0, joined: 0 };
                          mOffSum += ms.offered || 0;
                          mJoinSum += ms.joined || 0;
                        });
                        return (
                          <td key={ym} className="n">
                            <span style={{ color: '#38bdf8' }}>{fmt(mOffSum)}</span> / <span style={{ color: '#10b981' }}>{fmt(mJoinSum)}</span>
                          </td>
                        );
                      })}
                      <td className="n">
                        <span style={{ color: '#38bdf8' }}>{fmt(groupOffered)}</span> / <span style={{ color: '#10b981' }}>{fmt(groupJoined)}</span>
                      </td>
                      <td className="n">
                        {groupTarget > 0 ? `${Math.round((groupJoined / groupTarget) * 100)}%` : '—'}
                      </td>
                      <td className="n">—</td>
                      <td className="n">—</td>
                    </tr>
                  </Fragment>
                );
              })}

              {/* Former / Unlisted Recruiters Row (so totals reconcile 100% with Master Offered) */}
              {(summaryKpis.unlistedOffered > 0 || summaryKpis.unlistedJoined > 0) && (
                <tr style={{ fontStyle: 'italic', color: mutedColor, background: theme === 'light' ? '#fffbeb' : 'rgba(234, 179, 8, 0.05)' }}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      background: theme === 'light' ? '#fffbeb' : '#171c28',
                      fontWeight: 600,
                    }}
                  >
                    Former / Unlisted Recruiters
                  </td>
                  <td>—</td>
                  <td className="n">—</td>
                  {displayedMonths.map((ym) => {
                    const uStat = (activeSheetTotals.unlistedByMonth && activeSheetTotals.unlistedByMonth[ym]) || { offered: 0, joined: 0 };
                    return (
                      <td key={ym} className="n">
                        {uStat.offered === 0 && uStat.joined === 0 ? (
                          '—'
                        ) : (
                          <span>
                            <span style={{ color: '#38bdf8' }}>{fmt(uStat.offered)}</span> / <span style={{ color: '#10b981' }}>{fmt(uStat.joined)}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="n" style={{ fontWeight: 700 }}>
                    <span style={{ color: '#38bdf8' }}>{fmt(summaryKpis.unlistedOffered)}</span>
                    {' / '}
                    <span style={{ color: '#10b981' }}>{fmt(summaryKpis.unlistedJoined)}</span>
                  </td>
                  <td className="n">—</td>
                  <td className="n">—</td>
                  <td className="n">—</td>
                </tr>
              )}
            </tbody>

            {/* Grand Total Footer Directly from Master Offered */}
            <tfoot>
              <tr style={{ fontWeight: 800, background: theme === 'light' ? '#e2e8f0' : 'rgba(16, 185, 129, 0.12)' }}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: theme === 'light' ? '#e2e8f0' : '#0f292a',
                  }}
                >
                  Total (Direct from Master Offered)
                </td>
                <td>All</td>
                <td className="n">{fmt(summaryKpis.totalTarget)}</td>
                {displayedMonths.map((ym) => {
                  const dMonth = (activeSheetTotals.byMonth && activeSheetTotals.byMonth[ym]) || { offered: 0, joined: 0 };
                  return (
                    <td key={ym} className="n">
                      <span style={{ color: '#38bdf8' }}>{fmt(dMonth.offered)}</span> / <span style={{ color: '#10b981' }}>{fmt(dMonth.joined)}</span>
                    </td>
                  );
                })}
                <td className="n">
                  <span style={{ color: '#38bdf8' }}>{fmt(summaryKpis.totalOffered)}</span> / <span style={{ color: '#10b981' }}>{fmt(summaryKpis.totalJoined)}</span>
                </td>
                <td className="n">
                  {summaryKpis.totalTarget > 0
                    ? `${Math.round((summaryKpis.totalJoined / summaryKpis.totalTarget) * 100)}%`
                    : '—'}
                </td>
                <td className="n">—</td>
                <td className="n">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- small chart pieces & expandable rows ---------- */

function MetricCellButton({ value, onClick }) {
  const numVal = Number(value) || 0;
  if (numVal <= 0) return <span>{fmt(numVal)}</span>;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} title="Click to view candidate details" style={{ display: 'inline-block', background: 'rgba(56, 189, 248, 0.16)', border: '1px solid #38bdf8', borderRadius: '6px', padding: '2px 9px', color: '#38bdf8', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
      {fmt(numVal)}
    </button>
  );
}

function BuJobsRow({ buLabel, allJobs, onOpenJobModal }) {
  const buJobs = useMemo(() => {
    return (allJobs || []).filter((j) => j.businessUnit === buLabel).sort((a, b) => norm(a.department).localeCompare(norm(b.department)));
  }, [buLabel, allJobs]);

  if (!buJobs.length) return null;

  return (
    <tr>
      <td colSpan={17} style={{ padding: '14px 18px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '2px solid rgba(128,128,128,0.15)' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#eab308', letterSpacing: '0.02em' }}>
          {buLabel} — {fmt(buJobs.length)} Jobs (Sorted by Department)
        </div>
        <div className="table-scroll">
          <table className="jobs" style={{ margin: 0, width: '100%' }}>
            <thead>
              <tr>
                <th>Department</th>
                <th>Job ID</th>
                <th>Role</th>
                <th>Cat.</th>
                <th>Status</th>
                <th className="n">Total</th>
                <th className="n" title="Req Activation Date">Req Act.</th>
                <th className="n" title="Top of Funnel">Top Funnel</th>
                <th className="n" title="TA Shortlisted">TA Short.</th>
                <th className="n" title="Resume Screen Pending">Resume Pend.</th>
                <th className="n" title="Candidates in R1">R1 Cand.</th>
                <th className="n" title="R1 Select">R1 Sel.</th>
                <th className="n" title="Candidates in R2">R2 Cand.</th>
                <th className="n" title="R2 Select">R2 Sel.</th>
                <th className="n" title="Candidates in R3">R3 Cand.</th>
                <th className="n" title="R3 Select">R3 Sel.</th>
                <th className="n">Yet to offer</th>
                <th className="n">Offered</th>
                <th className="n">Joined</th>
                <th className="n">Pending</th>
              </tr>
            </thead>
            <tbody>
              {buJobs.map((j) => (
                <tr key={`${j.unitKey || 'u'}-${j.jobId}`}>
                  <td style={{ fontWeight: 600 }}>{j.department || '—'}</td>
                  <td className="mono">{j.jobId}</td>
                  <td>{j.role || '—'}</td>
                  <td>{j.category || '—'}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="n">{fmt(j.total)}</td>
                  <td className="n" style={{ fontSize: '12px' }}>{j.reqActivationDate || '—'}</td>
                  <td className="n">{fmt(j.topOfFunnel)}</td>
                  <td className="n">{fmt(j.taShortlisted)}</td>
                  <td className="n">{fmt(j.resumeScreenPending)}</td>
                  <td className="n">{fmt(j.candidatesR1)}</td>
                  <td className="n">{fmt(j.r1Select)}</td>
                  <td className="n">{fmt(j.candidatesR2)}</td>
                  <td className="n">{fmt(j.r2Select)}</td>
                  <td className="n">{fmt(j.candidatesR3)}</td>
                  <td className="n">{fmt(j.r3Select)}</td>
                  <td className="n"><MetricCellButton value={j.yetToOffer} onClick={() => onOpenJobModal(j, 'yetToOffer')} /></td>
                  <td className="n"><MetricCellButton value={j.offered} onClick={() => onOpenJobModal(j, 'offered')} /></td>
                  <td className="n"><MetricCellButton value={j.joined} onClick={() => onOpenJobModal(j, 'joined')} /></td>
                  <td className="n strong">{fmt(j.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  const key = norm(status);
  const cls = key === 'open' ? 'open' : key === 'closed' ? 'closed' : 'warn';
  return <span className={`badge ${cls}`}><i aria-hidden="true" />{status || '—'}</span>;
}

/* ---------- Merge helpers across MU + TETR ---------- */
function mergeMomSeries(muSeries = [], tetrSeries = []) {
  const map = {};
  for (const item of [...muSeries, ...tetrSeries]) {
    if (!item || !item.month) continue;
    if (!map[item.month]) {
      map[item.month] = { month: item.month, offered: 0, joined: 0, byBu: {}, offeredCandidates: [], joinedCandidates: [] };
    }
    const target = map[item.month];
    target.offered += item.offered || 0;
    target.joined += item.joined || 0;
    if (item.byBu) {
      for (const [buName, counts] of Object.entries(item.byBu)) {
        if (!target.byBu[buName]) target.byBu[buName] = { offered: 0, joined: 0 };
        target.byBu[buName].offered += counts.offered || 0;
        target.byBu[buName].joined += counts.joined || 0;
      }
    }
    if (Array.isArray(item.offeredCandidates)) target.offeredCandidates.push(...item.offeredCandidates);
    if (Array.isArray(item.joinedCandidates)) target.joinedCandidates.push(...item.joinedCandidates);
  }
  return Object.keys(map).sort().map((m) => map[m]);
}

function mergeChannelBreakdown(muBk = {}, tetrBk = {}) {
  const out = {};
  const keys = new Set([...Object.keys(muBk), ...Object.keys(tetrBk)]);
  keys.forEach((k) => { out[k] = (muBk[k] || 0) + (tetrBk[k] || 0); });
  return out;
}

function mergeChannelBreakdownByBu(muByBu = {}, tetrByBu = {}) {
  const out = {};
  const bus = new Set([...Object.keys(muByBu), ...Object.keys(tetrByBu)]);
  bus.forEach((buName) => {
    out[buName] = mergeChannelBreakdown(muByBu[buName] || {}, tetrByBu[buName] || {});
  });
  return out;
}

function mergeEfficiencyMap(muMap = {}, tetrMap = {}) {
  const out = {};
  const keys = new Set([...Object.keys(muMap), ...Object.keys(tetrMap)]);
  keys.forEach((ch) => {
    const muStats = muMap[ch] || { applied: 0, joined: 0 };
    const tetrStats = tetrMap[ch] || { applied: 0, joined: 0 };
    out[ch] = {
      applied: muStats.applied + tetrStats.applied,
      joined: muStats.joined + tetrStats.joined
    };
  });
  return out;
}

function mergeEfficiencyMapByBu(muByBu = {}, tetrByBu = {}) {
  const out = {};
  const bus = new Set([...Object.keys(muByBu), ...Object.keys(tetrByBu)]);
  bus.forEach((buName) => {
    out[buName] = mergeEfficiencyMap(muByBu[buName] || {}, tetrByBu[buName] || {});
  });
  return out;
}

function mergeMonthlyEfficiency(muMonthly = {}, tetrMonthly = {}) {
  const out = {};
  const months = new Set([...Object.keys(muMonthly), ...Object.keys(tetrMonthly)]);
  months.forEach((ym) => {
    out[ym] = mergeEfficiencyMap(muMonthly[ym] || {}, tetrMonthly[ym] || {});
  });
  return out;
}

function mergeMonthlyEfficiencyByBu(muByBu = {}, tetrByBu = {}) {
  const out = {};
  const bus = new Set([...Object.keys(muByBu), ...Object.keys(tetrByBu)]);
  bus.forEach((buName) => {
    out[buName] = mergeMonthlyEfficiency(muByBu[buName] || {}, tetrByBu[buName] || {});
  });
  return out;
}

function mergeChannelMom(muMom = [], tetrMom = []) {
  const map = {};
  for (const item of [...muMom, ...tetrMom]) {
    if (!item || !item.month) continue;
    if (!map[item.month]) {
      map[item.month] = { month: item.month, internalGroup: 0, businessReference: 0, external: 0, totalJoined: 0, externalPct: 0 };
    }
    const target = map[item.month];
    target.internalGroup += item.internalGroup || 0;
    target.businessReference += item.businessReference || 0;
    target.external += item.external || 0;
    target.totalJoined += item.totalJoined || 0;
  }
  return Object.keys(map).sort().map((ym) => {
    const obj = map[ym];
    const extPct = obj.totalJoined > 0 ? Math.round((obj.external / obj.totalJoined) * 1000) / 10 : 0;
    return { ...obj, externalPct: extPct };
  });
}

function mergeChannelMomByBu(muMap = {}, tetrMap = {}) {
  const out = {};
  const bus = new Set([...Object.keys(muMap), ...Object.keys(tetrMap)]);
  bus.forEach((buName) => {
    out[buName] = mergeChannelMom(muMap[buName] || [], tetrMap[buName] || []);
  });
  return out;
}

/* ---------- main ---------- */

export default function Dashboard({ unitKey = 'overall' }) {
  const initialKey = UNIT_META[unitKey] ? unitKey : 'overall';
  const [activeUnit, setActiveUnit] = useState(initialKey);
  const [datasets, setDatasets] = useState({ mu: null, tetr: null });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [bu, setBu] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [modalData, setModalData] = useState(null);
  
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ta_dashboard_theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ta_dashboard_theme', theme);
      if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
      } else {
        document.documentElement.classList.remove('light-theme');
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };
  const lastStamp = useRef('');

  const openJobModal = useCallback((job, metricType) => {
    const candidates = (job.candidates || []).map((c) => ({ ...c, jobId: job.jobId, role: job.role }));
    setModalData({
      title: `${job.jobId} — ${job.role || 'Role'} (${job.department || 'Department'})`,
      subtitle: job.businessUnit,
      candidates,
      metricType,
    });
  }, []);

  const openBuModal = useCallback((buLabel, unitJobs, metricType) => {
    const buJobs = (unitJobs || []).filter((j) => j.businessUnit === buLabel);
    const candidates = buJobs.flatMap((j) =>
      (j.candidates || []).map((c) => ({ ...c, jobId: j.jobId, role: j.role }))
    );
    setModalData({
      title: `${buLabel} — All ${METRIC_LABELS[metricType]} Candidates`,
      subtitle: buLabel,
      candidates,
      metricType,
    });
  }, []);

  const openMomModal = useCallback((monthLabel, candidates, metricType) => {
    setModalData({
      title: `${monthLabel} — ${METRIC_LABELS[metricType]}`,
      subtitle: bu === 'all' ? 'All Business Units' : bu,
      candidates: candidates || [],
      metricType,
    });
  }, [bu]);

  const handleSelectUnit = (key) => {
    setActiveUnit(key);
    setBu('all');
    setShowAll(false);
    if (typeof window !== 'undefined') {
      const targetPath = key === 'overall' ? '/' : `/${key}/`;
      window.history.replaceState(null, '', targetPath);
    }
  };

  const load = useCallback(async (refresh) => {
    setRefreshing(true);
    setNotice('');
    try {
      const t = Date.now();
      let resMu, resTetr;
      try {
        [resMu, resTetr] = await Promise.all([
          fetch(`/data/mu.json?t=${t}`, { cache: 'no-store' }),
          fetch(`/data/tetr.json?t=${t}`, { cache: 'no-store' }),
        ]);
      } catch {
        throw new Error('Could not load the data. Check your internet connection and try again.');
      }

      if (resMu.status === 404 && resTetr.status === 404) {
        throw new Error('No data has been published yet. In the TA data sheet, choose TA Dashboard > Publish now.');
      }
      if (!resMu.ok || !resTetr.ok) {
        throw new Error('Could not load the data. Try again in a minute.');
      }

      let muJson, tetrJson;
      try {
        [muJson, tetrJson] = await Promise.all([resMu.json(), resTetr.json()]);
      } catch {
        throw new Error('The data files could not be read. Publish again from the TA data sheet.');
      }

      setDatasets({ mu: muJson, tetr: tetrJson });
      setError('');

      const newestStamp = [muJson.fetchedAt, tetrJson.fetchedAt].sort().pop() || '';
      if (refresh && lastStamp.current === newestStamp) {
        setNotice('You already have the latest published data. New numbers appear after the sheet is published.');
      }
      lastStamp.current = newestStamp;
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const data = useMemo(() => {
    const { mu, tetr } = datasets;
    if (!mu || !tetr) return null;
    if (activeUnit === 'mu') return mu;
    if (activeUnit === 'tetr') return tetr;

    return {
      fetchedAt: [mu.fetchedAt, tetr.fetchedAt].sort().pop(),
      source: mu.source === 'mock' || tetr.source === 'mock' ? 'mock' : 'sheet',
      businessUnits: [
        ...(mu.businessUnits || []).map((b) => ({ ...b, unitKey: 'mu', unitLabel: 'Masters’ Union' })),
        ...(tetr.businessUnits || []).map((b) => ({ ...b, unitKey: 'tetr', unitLabel: 'TETR' })),
      ],
      jobs: [
        ...(mu.jobs || []).map((j) => ({ ...j, unitKey: 'mu', unitLabel: 'Masters’ Union' })),
        ...(tetr.jobs || []).map((j) => ({ ...j, unitKey: 'tetr', unitLabel: 'TETR' })),
      ],
      momSeries: mergeMomSeries(mu.momSeries, tetr.momSeries),
      channelBreakdown: mergeChannelBreakdown(mu.channelBreakdown, tetr.channelBreakdown),
      channelBreakdownByBu: mergeChannelBreakdownByBu(mu.channelBreakdownByBu, tetr.channelBreakdownByBu),
      currentChannelBreakdown: mergeChannelBreakdown(mu.currentChannelBreakdown, tetr.currentChannelBreakdown),
      currentChannelBreakdownByBu: mergeChannelBreakdownByBu(mu.currentChannelBreakdownByBu, tetr.currentChannelBreakdownByBu),
      channelEfficiencyOverall: mergeEfficiencyMap(mu.channelEfficiencyOverall, tetr.channelEfficiencyOverall),
      channelEfficiencyOverallByBu: mergeEfficiencyMapByBu(mu.channelEfficiencyOverallByBu, tetr.channelEfficiencyOverallByBu),
      channelEfficiencyMonthly: mergeMonthlyEfficiency(mu.channelEfficiencyMonthly, tetr.channelEfficiencyMonthly),
      channelEfficiencyMonthlyByBu: mergeMonthlyEfficiencyByBu(mu.channelEfficiencyMonthlyByBu, tetr.channelEfficiencyMonthlyByBu),
      channelMomSeries: mergeChannelMom(mu.channelMomSeries, tetr.channelMomSeries),
      channelMomByBu: mergeChannelMomByBu(mu.channelMomByBu, tetr.channelMomByBu),
      recruiterPerformance: mu.recruiterPerformanceOverall || mu.recruiterPerformance || {},
      recruiterPerformanceByBu: {
        ...(mu.recruiterPerformanceByBu || {}),
        ...(tetr.recruiterPerformanceByBu || {}),
      },
      checks: [
        ...(mu.checks || []),
        ...(tetr.checks || []),
      ],
    };
  }, [datasets, activeUnit]);

  const slicerCounts = useMemo(() => {
    const { mu, tetr } = datasets;
    if (!mu || !tetr) return { overall: 0, mu: 0, tetr: 0 };
    const muOpen = sumManpower(mu.businessUnits || []).openRoles;
    const tetrOpen = sumManpower(tetr.businessUnits || []).openRoles;
    return {
      overall: muOpen + tetrOpen,
      mu: muOpen,
      tetr: tetrOpen,
    };
  }, [datasets]);

  const scopeBUs = useMemo(
    () => (data ? data.businessUnits.filter((b) => bu === 'all' || b.label === bu) : []),
    [data, bu]
  );
  const kpi = useMemo(() => sumManpower(scopeBUs), [scopeBUs]);
  const allTotals = useMemo(() => (data ? sumManpower(data.businessUnits) : null), [data]);
  const muTotals = useMemo(() => (datasets.mu ? sumManpower(datasets.mu.businessUnits) : null), [datasets.mu]);
  const tetrTotals = useMemo(() => (datasets.tetr ? sumManpower(datasets.tetr.businessUnits) : null), [datasets.tetr]);

  const checks = useMemo(
    () => (data ? data.checks.filter((c) => bu === 'all' || c.businessUnit === bu) : []),
    [data, bu]
  );

  const updated = data
    ? new Date(data.fetchedAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      })
    : '';

  const currentMeta = UNIT_META[activeUnit] || UNIT_META.overall;

  return (
    <AccessGate>
      {({ currentUser, onSignOut }) => (
        <div className={`page ${theme === 'light' ? 'light-mode-forced' : ''}`} style={theme === 'light' ? { background: '#f8fafc', color: '#0f172a' } : {}}>
          <style jsx global>{`
            .wrap, .top-inner {
              max-width: 1460px !important;
              padding-left: 28px !important;
              padding-right: 28px !important;
            }
            .table-scroll {
              overflow-x: auto !important;
              scrollbar-width: thin;
              scrollbar-color: rgba(148, 163, 184, 0.45) rgba(15, 23, 42, 0.4);
            }
            .table-scroll::-webkit-scrollbar {
              height: 8px;
            }
            .table-scroll::-webkit-scrollbar-track {
              background: rgba(15, 23, 42, 0.35);
              border-radius: 999px;
            }
            .table-scroll::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.45);
              border-radius: 999px;
            }
            .table-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.7);
            }
            .page.light-mode-forced {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
            }
            .page.light-mode-forced .top {
              background: #ffffff !important;
              border-bottom: 1px solid #cbd5e1 !important;
            }
            .page.light-mode-forced h1, .page.light-mode-forced h2, .page.light-mode-forced h3 {
              color: #0f172a !important;
            }
            .page.light-mode-forced .kpis > div, 
            .page.light-mode-forced .panel, 
            .page.light-mode-forced .figs > div {
              background: #ffffff !important;
              border: 1px solid #cbd5e1 !important;
              color: #1e293b !important;
            }
            .page.light-mode-forced table.bu-table, 
            .page.light-mode-forced table.jobs {
              background: #ffffff !important;
              color: #1e293b !important;
            }
            .page.light-mode-forced table.bu-table th, 
            .page.light-mode-forced table.jobs th {
              background: #e2e8f0 !important;
              color: #0f172a !important;
            }
            .page.light-mode-forced table.bu-table td, 
            .page.light-mode-forced table.jobs td {
              border-bottom: 1px solid #e2e8f0 !important;
              color: #334155 !important;
            }
            .page.light-mode-forced .chip {
              background: #ffffff !important;
              border: 1px solid #cbd5e1 !important;
              color: #334155 !important;
            }
            .page.light-mode-forced .chip.on {
              background: #059669 !important;
              color: #ffffff !important;
            }
          `}</style>

          <header className="top">
            <div className="top-inner">
              <div>
                <p className="kicker">Talent Acquisition</p>
                <h1>{currentMeta.title}</h1>
              </div>
              <div className="actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {data && <span className="stamp">Data as of {updated} IST</span>}
                
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                    color: theme === 'dark' ? '#fde047' : '#0f172a',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>

                <button type="button" className="refresh" onClick={() => load(true)} disabled={refreshing}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={refreshing ? 'spin' : ''}>
                    <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {refreshing ? 'Refreshing…' : 'Refresh data'}
                </button>
                {currentUser && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    title={`Signed in as ${currentUser.email}`}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'inherit',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {currentUser.name} · Sign out
                  </button>
                )}
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
                <nav
                  aria-label="Payroll Unit Slicer"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
                  {Object.values(UNIT_META).map((u) => {
                    const isSelected = activeUnit === u.key;
                    return (
                      <button
                        key={u.key}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectUnit(u.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #eab308' : '1px solid rgba(255, 255, 255, 0.14)',
                          background: isSelected ? '#059669' : (theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.05)'),
                          color: isSelected ? '#ffffff' : (theme === 'light' ? '#0f172a' : '#e2e8f0'),
                          fontWeight: 600,
                          fontSize: '15px',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 4px 12px rgba(5, 150, 105, 0.35)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{u.label}</span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: '999px',
                            background: isSelected ? 'rgba(0, 0, 0, 0.25)' : (theme === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'),
                            color: isSelected ? '#ffffff' : (theme === 'light' ? '#334155' : '#cbd5e1'),
                          }}
                        >
                          {fmt(slicerCounts[u.key])} open roles
                        </span>
                      </button>
                    );
                  })}
                </nav>

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
                        {activeUnit === 'overall' ? (
                          <>
                            {datasets.mu.businessUnits.map((b) => (
                              <Fragment key={`mu-${b.label}`}>
                                <tr className={bu === b.label ? 'sel' : ''}>
                                  <td>
                                    <button type="button" className="link" onClick={() => { setBu(bu === b.label ? 'all' : b.label); setShowAll(false); }}>
                                      {b.label} {bu === b.label ? '▼' : '▶'}
                                    </button>
                                  </td>
                                  <td className="n">{fmt(b.manpower.openRoles)}</td>
                                  <td className="n">{fmt(b.manpower.total)}</td>
                                  <td className="n"><MetricCellButton value={b.manpower.yetToOffer} onClick={() => openBuModal(b.label, datasets.mu.jobs, 'yetToOffer')} /></td>
                                  <td className="n"><MetricCellButton value={b.manpower.offered} onClick={() => openBuModal(b.label, datasets.mu.jobs, 'offered')} /></td>
                                  <td className="n"><MetricCellButton value={b.manpower.joined} onClick={() => openBuModal(b.label, datasets.mu.jobs, 'joined')} /></td>
                                  <td className="n">{fmt(b.manpower.pending)}</td>
                                </tr>
                                {bu === b.label && (
                                  <BuJobsRow buLabel={b.label} allJobs={datasets.mu.jobs} onOpenJobModal={openJobModal} />
                                )}
                              </Fragment>
                            ))}
                            {muTotals && (
                              <tr style={{ fontWeight: 600 }}>
                                <td>Subtotal · Masters’ Union</td>
                                <td className="n">{fmt(muTotals.openRoles)}</td>
                                <td className="n">{fmt(muTotals.total)}</td>
                                <td className="n">{fmt(muTotals.yetToOffer)}</td>
                                <td className="n">{fmt(muTotals.offered)}</td>
                                <td className="n">{fmt(muTotals.joined)}</td>
                                <td className="n">{fmt(muTotals.pending)}</td>
                              </tr>
                            )}
                            {datasets.tetr.businessUnits.map((b) => (
                              <Fragment key={`tetr-${b.label}`}>
                                <tr className={bu === b.label ? 'sel' : ''}>
                                  <td>
                                    <button type="button" className="link" onClick={() => { setBu(bu === b.label ? 'all' : b.label); setShowAll(false); }}>
                                      {b.label} {bu === b.label ? '▼' : '▶'}
                                    </button>
                                  </td>
                                  <td className="n">{fmt(b.manpower.openRoles)}</td>
                                  <td className="n">{fmt(b.manpower.total)}</td>
                                  <td className="n"><MetricCellButton value={b.manpower.yetToOffer} onClick={() => openBuModal(b.label, datasets.tetr.jobs, 'yetToOffer')} /></td>
                                  <td className="n"><MetricCellButton value={b.manpower.offered} onClick={() => openBuModal(b.label, datasets.tetr.jobs, 'offered')} /></td>
                                  <td className="n"><MetricCellButton value={b.manpower.joined} onClick={() => openBuModal(b.label, datasets.tetr.jobs, 'joined')} /></td>
                                  <td className="n">{fmt(b.manpower.pending)}</td>
                                </tr>
                                {bu === b.label && (
                                  <BuJobsRow buLabel={b.label} allJobs={datasets.tetr.jobs} onOpenJobModal={openJobModal} />
                                )}
                              </Fragment>
                            ))}
                            {tetrTotals && (
                              <tr style={{ fontWeight: 600 }}>
                                <td>Subtotal · TETR</td>
                                <td className="n">{fmt(tetrTotals.openRoles)}</td>
                                <td className="n">{fmt(tetrTotals.total)}</td>
                                <td className="n">{fmt(tetrTotals.yetToOffer)}</td>
                                <td className="n">{fmt(tetrTotals.offered)}</td>
                                <td className="n">{fmt(tetrTotals.joined)}</td>
                                <td className="n">{fmt(tetrTotals.pending)}</td>
                              </tr>
                            )}
                          </>
                        ) : (
                          data.businessUnits.map((b) => (
                            <Fragment key={b.label}>
                              <tr className={bu === b.label ? 'sel' : ''}>
                                <td>
                                  <button type="button" className="link" onClick={() => { setBu(bu === b.label ? 'all' : b.label); setShowAll(false); }}>
                                    {b.label} {bu === b.label ? '▼' : '▶'}
                                  </button>
                                </td>
                                <td className="n">{fmt(b.manpower.openRoles)}</td>
                                <td className="n">{fmt(b.manpower.total)}</td>
                                <td className="n"><MetricCellButton value={b.manpower.yetToOffer} onClick={() => openBuModal(b.label, data.jobs, 'yetToOffer')} /></td>
                                <td className="n"><MetricCellButton value={b.manpower.offered} onClick={() => openBuModal(b.label, data.jobs, 'offered')} /></td>
                                <td className="n"><MetricCellButton value={b.manpower.joined} onClick={() => openBuModal(b.label, data.jobs, 'joined')} /></td>
                                <td className="n">{fmt(b.manpower.pending)}</td>
                              </tr>
                              {bu === b.label && (
                                <BuJobsRow buLabel={b.label} allJobs={data.jobs} onOpenJobModal={openJobModal} />
                              )}
                            </Fragment>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>{activeUnit === 'overall' ? 'Grand Total (MU + TETR)' : `All ${currentMeta.label} Business Units`}</td>
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

                <MomLineChart
                  series={data.momSeries || []}
                  selectedBu={bu}
                  theme={theme}
                  onSelectPoint={openMomModal}
                />

                <ChannelAnalysisSection
                  channelBreakdown={data.channelBreakdown || {}}
                  channelBreakdownByBu={data.channelBreakdownByBu || {}}
                  currentChannelBreakdown={data.currentChannelBreakdown || {}}
                  currentChannelBreakdownByBu={data.currentChannelBreakdownByBu || {}}
                  channelEfficiencyOverall={data.channelEfficiencyOverall || {}}
                  channelEfficiencyOverallByBu={data.channelEfficiencyOverallByBu || {}}
                  channelEfficiencyMonthly={data.channelEfficiencyMonthly || {}}
                  channelEfficiencyMonthlyByBu={data.channelEfficiencyMonthlyByBu || {}}
                  channelMomSeries={data.channelMomSeries || []}
                  channelMomByBu={data.channelMomByBu || {}}
                  selectedBu={bu}
                  theme={theme}
                />

                {/* Confidential-Safe Recruiter Performance Section */}
                <RecruiterPerformanceSection
                  recruiterPerformance={data.recruiterPerformance}
                  recruiterPerformanceByBu={data.recruiterPerformanceByBu}
                  selectedBu={bu}
                  theme={theme}
                />

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

          {modalData && (
            <CandidateModal modalData={modalData} onClose={() => setModalData(null)} />
          )}
        </div>
      )}
    </AccessGate>
  );
}