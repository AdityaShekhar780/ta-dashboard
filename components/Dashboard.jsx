'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const nf = new Intl.NumberFormat('en-IN');
const fmt = (n) => (n === '—' || n === '-' ? '—' : nf.format(Number(n) || 0));
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
  const out = {
    openRoles: 0,
    needToClose: 0,
    closedRoles: 0,
    total: 0,
    adHoc: 0,
    monthlyApproved: 0,
    lastMonthCf: 0,
    yetToOffer: 0,
    offered: 0,
    joined: 0,
    pending: 0,
    pendingOnTrack: 0,
    pendingDelayed: 0,
    pendingCritical: 0,
    cvLess5Count: 0,
    replacement: 0,
  };
  for (const b of bus) {
    for (const k of Object.keys(out)) {
      out[k] += b.manpower?.[k] || 0;
    }
  }
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

function normalizeCandidateChannelGroup(rawChannel) {
  const low = norm(rawChannel);
  if (!low || low === '—' || low === '-') return 'external';
  if (low.includes('internal') || low.includes('campus') || low.includes('career')) return 'internalGroup';
  if (low.includes('employee') || low.includes('referral')) return 'employeeReferral';
  if (low.includes('business') || low.includes('refrence') || low.includes('reference')) return 'businessReference';
  return 'external';
}

function recruiterNamesMatch(candRec, targetRec) {
  const a = norm(candRec).replace(/\s*\([^)]*\)\s*$/, '');
  const b = norm(targetRec).replace(/\s*\([^)]*\)\s*$/, '');
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
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

/* ---------- Total Positions Breakdown Modal (Ad-Hoc, Monthly Approved, Last Month C/F) ---------- */

function TotalPositionsModal({ open, onClose, scopeBUs = [], kpi = {}, selectedBu, unitTitle, theme }) {
  if (!open) return null;

  const totalPos = kpi.total || 0;
  const adHoc = kpi.adHoc || 0;
  const monthlyApproved = kpi.monthlyApproved || 0;
  const lastMonthCf = kpi.lastMonthCf || 0;

  const pct = (val) => (totalPos > 0 ? Math.round((val / totalPos) * 1000) / 10 : 0);

  const splitCards = [
    {
      key: 'adHoc',
      label: 'Ad-Hoc',
      value: adHoc,
      share: pct(adHoc),
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.12)',
      border: 'rgba(56, 189, 248, 0.4)',
    },
    {
      key: 'monthlyApproved',
      label: 'Monthly Approved',
      value: monthlyApproved,
      share: pct(monthlyApproved),
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.4)',
    },
    {
      key: 'lastMonthCf',
      label: 'Last Month C/F',
      value: lastMonthCf,
      share: pct(lastMonthCf),
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.12)',
      border: 'rgba(234, 179, 8, 0.4)',
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.65)',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Positions Split · {selectedBu === 'all' ? 'All Business Units' : selectedBu}
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: '20px' }}>
              {unitTitle} — {fmt(totalPos)} Total Positions
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(148, 163, 184, 0.15)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              color: 'inherit',
              width: '34px',
              height: '34px',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            {splitCards.map((c) => (
              <div
                key={c.key}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: c.color, letterSpacing: '0.03em' }}>
                  {c.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                  <strong style={{ fontSize: '26px', color: c.color, lineHeight: 1.1 }}>{fmt(c.value)}</strong>
                  <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.85 }}>{c.share}% of total</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(148, 163, 184, 0.2)', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
                  <div style={{ width: `${Math.min(100, c.share)}%`, height: '100%', background: c.color, borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="table-scroll">
            <table className="bu-table" style={{ margin: 0, width: '100%', tableLayout: 'fixed', minWidth: '540px' }}>
              <thead>
                <tr>
                  <th style={{ width: '36%' }}>Business Unit</th>
                  <th className="n" style={{ width: '16%' }}>Total Positions</th>
                  <th className="n" style={{ width: '16%', color: '#38bdf8' }}>Ad-Hoc</th>
                  <th className="n" style={{ width: '16%', color: '#10b981' }}>Monthly Approved</th>
                  <th className="n" style={{ width: '16%', color: '#eab308' }}>Last Month C/F</th>
                </tr>
              </thead>
              <tbody>
                {scopeBUs.map((b) => (
                  <tr key={`${b.unitKey || 'u'}-${b.label}`}>
                    <td style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</td>
                    <td className="n" style={{ fontWeight: 700 }}>{fmt(b.manpower?.total)}</td>
                    <td className="n" style={{ color: '#38bdf8', fontWeight: 600 }}>{fmt(b.manpower?.adHoc)}</td>
                    <td className="n" style={{ color: '#10b981', fontWeight: 600 }}>{fmt(b.manpower?.monthlyApproved)}</td>
                    <td className="n" style={{ color: '#eab308', fontWeight: 600 }}>{fmt(b.manpower?.lastMonthCf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800 }}>
                  <td>Total</td>
                  <td className="n">{fmt(totalPos)}</td>
                  <td className="n" style={{ color: '#38bdf8' }}>{fmt(adHoc)}</td>
                  <td className="n" style={{ color: '#10b981' }}>{fmt(monthlyApproved)}</td>
                  <td className="n" style={{ color: '#eab308' }}>{fmt(lastMonthCf)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Pending Positions Breakdown Modal (Clickable Cards & Table Cells -> Job List & Full Details) ---------- */

function PendingPositionsModal({ open, onClose, scopeBUs = [], allJobs = [], kpi = {}, selectedBu, unitTitle, theme }) {
  const [drillFilter, setDrillFilter] = useState(null); // { health: 'all' | 'On Track' | 'Delayed' | 'Critical', buLabel: 'all' | string }

  useEffect(() => {
    if (!open) setDrillFilter(null);
  }, [open]);

  const onTrack = kpi.pendingOnTrack || 0;
  const delayed = kpi.pendingDelayed || 0;
  const critical = kpi.pendingCritical || 0;
  const totalHealthPending = onTrack + delayed + critical;
  const denom = totalHealthPending > 0 ? totalHealthPending : (kpi.pending || 1);

  const pct = (val) => (denom > 0 ? Math.round((val / denom) * 1000) / 10 : 0);

  const healthCards = [
    {
      key: 'On Track',
      label: 'On Track',
      value: onTrack,
      share: pct(onTrack),
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.45)',
    },
    {
      key: 'Delayed',
      label: 'Delayed',
      value: delayed,
      share: pct(delayed),
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.12)',
      border: 'rgba(234, 179, 8, 0.45)',
    },
    {
      key: 'Critical',
      label: 'Critical',
      value: critical,
      share: pct(critical),
      color: '#f87171',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.45)',
    },
  ];

  // Filter jobs when user clicks a card or a table cell inside the Pending modal
  const drilledJobs = useMemo(() => {
    if (!drillFilter) return [];
    const targetBu = drillFilter.buLabel && drillFilter.buLabel !== 'all' ? drillFilter.buLabel : selectedBu;

    return (allJobs || []).filter((j) => {
      if (j.isManualForm) return false;
      const st = norm(j.status);
      const jh = norm(j.jobHealth);
      // Strictly exclude Closed jobs and jobs with 0 pending positions
      if (st === 'closed' || jh.includes('close')) return false;
      if ((Number(j.pending) || 0) <= 0) return false;

      if (targetBu !== 'all' && j.businessUnit !== targetBu) return false;

      if (drillFilter.health === 'On Track') return jh.includes('track');
      if (drillFilter.health === 'Delayed') return jh.includes('delay');
      if (drillFilter.health === 'Critical') return jh.includes('crit');
      // 'all' health inside the modal means any of On Track, Delayed, or Critical
      return jh.includes('track') || jh.includes('delay') || jh.includes('crit');
    });
  }, [drillFilter, allJobs, selectedBu]);

  const drilledPendingSum = useMemo(() => {
    return drilledJobs.reduce((acc, j) => acc + (Number(j.pending) || 0), 0);
  }, [drilledJobs]);

  if (!open) return null;

  const renderClickNum = (val, color, onClick, labelHint) => {
    const n = Number(val) || 0;
    if (n <= 0) return <span style={{ color, opacity: 0.45 }}>0</span>;
    return (
      <button
        type="button"
        onClick={onClick}
        title={labelHint || 'Click to view jobs'}
        style={{
          background:
            color === '#10b981'
              ? 'rgba(16, 185, 129, 0.15)'
              : color === '#eab308'
              ? 'rgba(234, 179, 8, 0.15)'
              : color === '#f87171'
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(56, 189, 248, 0.15)',
          border: `1px solid ${color}`,
          borderRadius: '6px',
          padding: '2px 9px',
          color,
          fontWeight: 700,
          fontSize: '12.5px',
          cursor: 'pointer',
        }}
      >
        {fmt(n)}
      </button>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: drillFilter ? '1180px' : '880px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.65)',
          transition: 'max-width 0.18s ease',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Positions by Job Health (Excluding Closed) ·{' '}
              {drillFilter?.buLabel && drillFilter.buLabel !== 'all'
                ? drillFilter.buLabel
                : selectedBu === 'all'
                ? 'All Business Units'
                : selectedBu}
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: '20px' }}>
              {drillFilter
                ? `${drillFilter.health === 'all' ? 'All Active Health Categories' : drillFilter.health} — ${fmt(drilledJobs.length)} Jobs (${fmt(drilledPendingSum)} Pending Positions)`
                : `${unitTitle} — ${fmt(totalHealthPending || kpi.pending)} Pending Positions`}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {drillFilter && (
              <button
                type="button"
                onClick={() => setDrillFilter(null)}
                style={{
                  padding: '7px 13px',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  background: 'rgba(56, 189, 248, 0.14)',
                  color: '#38bdf8',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                ← Back to BU Summary
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'rgba(148, 163, 184, 0.15)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                color: 'inherit',
                width: '34px',
                height: '34px',
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          {/* 3 Clickable Summary Cards (Always visible so user can switch between On Track / Delayed / Critical) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginBottom: '18px',
            }}
          >
            {healthCards.map((c) => {
              const isSelectedCard = drillFilter && drillFilter.health === c.key && (drillFilter.buLabel === 'all' || !drillFilter.buLabel);
              return (
                <div
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setDrillFilter(
                      isSelectedCard ? null : { health: c.key, buLabel: 'all' }
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDrillFilter(isSelectedCard ? null : { health: c.key, buLabel: 'all' });
                    }
                  }}
                  title={`Click to view ${c.label} jobs`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: c.bg,
                    border: isSelectedCard ? `2px solid ${c.color}` : `1px solid ${c.border}`,
                    boxShadow: isSelectedCard ? `0 0 0 3px ${c.bg}` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: c.color, letterSpacing: '0.03em' }}>
                      {c.label}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '999px',
                        background: 'rgba(0,0,0,0.25)',
                        color: c.color,
                      }}
                    >
                      {isSelectedCard ? 'Showing Jobs' : 'View Jobs →'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ fontSize: '26px', color: c.color, lineHeight: 1.1 }}>{fmt(c.value)}</strong>
                    <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.85 }}>{c.share}% of pending</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(148, 163, 184, 0.2)', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ width: `${Math.min(100, c.share)}%`, height: '100%', background: c.color, borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {!drillFilter ? (
            <>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '12.5px' }}>
                Click any card above or any number in the table below to see the full list of jobs and details:
              </p>
              <div className="table-scroll">
                <table className="bu-table" style={{ margin: 0, width: '100%', tableLayout: 'fixed', minWidth: '540px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '36%' }}>Business Unit</th>
                      <th className="n" style={{ width: '16%' }}>Pending Positions</th>
                      <th className="n" style={{ width: '16%', color: '#10b981' }}>On Track</th>
                      <th className="n" style={{ width: '16%', color: '#eab308' }}>Delayed</th>
                      <th className="n" style={{ width: '16%', color: '#f87171' }}>Critical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopeBUs.map((b) => {
                      const buOnTrack = b.manpower?.pendingOnTrack || 0;
                      const buDelayed = b.manpower?.pendingDelayed || 0;
                      const buCritical = b.manpower?.pendingCritical || 0;
                      const buHealthSum = buOnTrack + buDelayed + buCritical;
                      return (
                        <tr key={`${b.unitKey || 'u'}-${b.label}`}>
                          <td style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</td>
                          <td className="n" style={{ fontWeight: 700 }}>
                            {renderClickNum(
                              buHealthSum || b.manpower?.pending,
                              '#38bdf8',
                              () => setDrillFilter({ health: 'all', buLabel: b.label }),
                              `View all pending jobs in ${b.label}`
                            )}
                          </td>
                          <td className="n">
                            {renderClickNum(
                              buOnTrack,
                              '#10b981',
                              () => setDrillFilter({ health: 'On Track', buLabel: b.label }),
                              `View On Track pending jobs in ${b.label}`
                            )}
                          </td>
                          <td className="n">
                            {renderClickNum(
                              buDelayed,
                              '#eab308',
                              () => setDrillFilter({ health: 'Delayed', buLabel: b.label }),
                              `View Delayed pending jobs in ${b.label}`
                            )}
                          </td>
                          <td className="n">
                            {renderClickNum(
                              buCritical,
                              '#f87171',
                              () => setDrillFilter({ health: 'Critical', buLabel: b.label }),
                              `View Critical pending jobs in ${b.label}`
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 800 }}>
                      <td>Total</td>
                      <td className="n">
                        {renderClickNum(
                          totalHealthPending || kpi.pending,
                          '#38bdf8',
                          () => setDrillFilter({ health: 'all', buLabel: 'all' }),
                          'View all pending jobs'
                        )}
                      </td>
                      <td className="n">
                        {renderClickNum(
                          onTrack,
                          '#10b981',
                          () => setDrillFilter({ health: 'On Track', buLabel: 'all' }),
                          'View all On Track pending jobs'
                        )}
                      </td>
                      <td className="n">
                        {renderClickNum(
                          delayed,
                          '#eab308',
                          () => setDrillFilter({ health: 'Delayed', buLabel: 'all' }),
                          'View all Delayed pending jobs'
                        )}
                      </td>
                      <td className="n">
                        {renderClickNum(
                          critical,
                          '#f87171',
                          () => setDrillFilter({ health: 'Critical', buLabel: 'all' }),
                          'View all Critical pending jobs'
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            /* Drilled-Down Job List Table */
            <div className="table-scroll">
              {drilledJobs.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
                  No pending jobs found for this filter.
                </p>
              ) : (
                <table className="jobs" style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Role</th>
                      <th>Business Unit</th>
                      <th>Department</th>
                      <th>Cat.</th>
                      <th>Status</th>
                      <th>Job Health</th>
                      <th className="n">Req Act. Date</th>
                      <th className="n">Target Date</th>
                      <th className="n">Days to Target</th>
                      <th className="n">Total</th>
                      <th className="n">TOF</th>
                      <th className="n">Yet to Offer</th>
                      <th className="n">Offered</th>
                      <th className="n">Joined</th>
                      <th className="n">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilledJobs.map((j, idx) => (
                      <tr key={`${j.unitKey || 'u'}-${j.jobId}-${idx}`}>
                        <td className="mono" style={{ fontWeight: 700, color: '#38bdf8', whiteSpace: 'nowrap' }}>{j.jobId || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{j.role || '—'}</td>
                        <td>{j.businessUnit || '—'}</td>
                        <td>{j.department || '—'}</td>
                        <td>{j.category || '—'}</td>
                        <td><StatusBadge status={j.status} /></td>
                        <td><JobHealthBadge health={j.jobHealth} /></td>
                        <td className="n" style={{ whiteSpace: 'nowrap' }}>{j.reqActivationDate || '—'}</td>
                        <td className="n" style={{ whiteSpace: 'nowrap' }}>{j.targetDate || '—'}</td>
                        <td className="n">{j.daysToTarget || '—'}</td>
                        <td className="n">{fmt(j.total)}</td>
                        <td className="n">{fmt(j.topOfFunnel)}</td>
                        <td className="n">{fmt(j.yetToOffer)}</td>
                        <td className="n">{fmt(j.offered)}</td>
                        <td className="n">{fmt(j.joined)}</td>
                        <td className="n strong" style={{ color: '#fde047', fontWeight: 800 }}>{fmt(j.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Jobs With < 5 CVs Modal (Job ID, Business Unit, Department, Category, Req Act Date, TOF) ---------- */

function CvLess5Modal({ open, onClose, jobs = [], selectedBu, unitTitle, theme }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.65)',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Low Top-of-Funnel Alert (CV &lt; 5) · {selectedBu === 'all' ? 'All Business Units' : selectedBu}
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: '20px' }}>
              {unitTitle} — {fmt(jobs.length)} {jobs.length === 1 ? 'Job Has' : 'Jobs Have'} Less Than 5 CVs
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(148, 163, 184, 0.15)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              color: 'inherit',
              width: '34px',
              height: '34px',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          {jobs.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
              No jobs currently flagged with less than 5 CVs for this selection.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="jobs" style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Role</th>
                    <th>Business Unit</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th className="n">Req Act. Date</th>
                    <th className="n">TOF (Top of Funnel)</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j, idx) => (
                    <tr key={`${j.unitKey || 'u'}-${j.jobId}-${idx}`}>
                      <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{j.jobId || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{j.role || '—'}</td>
                      <td>{j.businessUnit || '—'}</td>
                      <td>{j.department || '—'}</td>
                      <td>{j.category || '—'}</td>
                      <td className="n" style={{ whiteSpace: 'nowrap' }}>{j.reqActivationDate || '—'}</td>
                      <td className="n" style={{ fontWeight: 800, color: '#f87171' }}>{fmt(j.topOfFunnel)}</td>
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
        maxWidth: '100%',
        overflow: 'hidden',
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

      <div className="table-scroll" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '6px' }}>
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

  const width = Math.max(960, activeMomSeries.length * 68);
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
        padding: '22px',
        borderRadius: '12px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
        color: textColor,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <style jsx>{`
        .channel-analysis-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.45fr);
          gap: 18px;
          align-items: stretch;
          width: 100%;
        }
        @media (max-width: 1024px) {
          .channel-analysis-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
          .channel-eff-card {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 680px) {
          .channel-analysis-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '22px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Channel Analysis</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            {selectedBu === 'all' ? 'All Business Units' : selectedBu} · Joining distribution & conversion efficiency
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
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

      <div className="channel-analysis-grid">
        <div
          style={{
            minWidth: 0,
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

        <div
          style={{
            minWidth: 0,
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

        <div
          className="channel-eff-card"
          style={{
            minWidth: 0,
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
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 500, gap: '8px', flexWrap: 'wrap' }}>
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

        <div
          style={{
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden',
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
            <div className="table-scroll" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '10px' }}>
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

/* ---------- Compact Clickable Number Pill for Recruiter Table ---------- */

function RecClickPill({ value, color, onClick, title }) {
  const numVal = Number(value) || 0;
  if (numVal <= 0 || !onClick) {
    return <span style={{ color, fontWeight: 600 }}>{fmt(numVal)}</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title || 'Click to view candidates'}
      style={{
        background: color === '#38bdf8' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(16, 185, 129, 0.14)',
        border: `1px solid ${color === '#38bdf8' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(16, 185, 129, 0.45)'}`,
        borderRadius: '5px',
        padding: '1px 6px',
        color,
        fontWeight: 700,
        fontSize: '12px',
        lineHeight: 1.25,
        cursor: 'pointer',
      }}
    >
      {fmt(numVal)}
    </button>
  );
}

/* ---------- Recruiter Performance Section ---------- */

function RecruiterPerformanceSection({
  recruiterPerformance,
  recruiterPerformanceByBu = {},
  momSeries = [],
  selectedBu,
  theme,
  onOpenCandidateModal
}) {
  const [viewScope, setViewScope] = useState('qtd');
  const [channelScope, setChannelScope] = useState('all');

  const activePerf = useMemo(() => {
    if (selectedBu !== 'all' && recruiterPerformanceByBu && recruiterPerformanceByBu[selectedBu]) {
      return recruiterPerformanceByBu[selectedBu];
    }
    return recruiterPerformance || {
      months: [],
      quarterMonths: [],
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

  const roiTarget = 15;

  const currentYm = useMemo(() => todayIST().slice(0, 7), []);
  const elapsedMonthsForAvg = useMemo(() => {
    const elapsed = displayedMonths.filter((ym) => ym <= currentYm);
    return elapsed.length > 0 ? elapsed : displayedMonths;
  }, [displayedMonths, currentYm]);

  const groupedRecruiters = useMemo(() => {
    const list = Array.isArray(activePerf.recruiters) ? activePerf.recruiters : [];
    const lateral = list.filter((r) => norm(r.hiringType) !== 'bulk');
    const bulk = list.filter((r) => norm(r.hiringType) === 'bulk');
    return [
      { key: 'Lateral', label: 'Lateral Hiring Recruiters', color: '#38bdf8', items: lateral },
      { key: 'Bulk', label: 'Bulk Hiring Recruiters', color: '#a78bfa', items: bulk },
    ].filter((g) => g.items.length > 0);
  }, [activePerf]);

  const getRecChannelData = useCallback((r) => {
    if (channelScope !== 'all' && r.byChannel && r.byChannel[channelScope]) {
      return r.byChannel[channelScope];
    }
    if (r.byChannel && r.byChannel.all) {
      return r.byChannel.all;
    }
    return r;
  }, [channelScope]);

  const getRecruiterAvgRoi = useCallback((chNode) => {
    if (!chNode || !chNode.byMonth || elapsedMonthsForAvg.length === 0) return 0;
    let sum = 0;
    elapsedMonthsForAvg.forEach((ym) => {
      const mStat = chNode.byMonth[ym];
      sum += Number(mStat?.roi || 0);
    });
    return Math.round((sum / elapsedMonthsForAvg.length) * 10) / 10;
  }, [elapsedMonthsForAvg]);

  const getRecruiterPeriodTarget = useCallback((r) => {
    const mTarget = Number(r.monthlyTarget ?? r.target ?? 0);
    if (viewScope === 'qtd') {
      return Number(r.quarterlyTarget ?? mTarget * 3);
    }
    return Number(r.overallTarget ?? mTarget * Math.max(1, displayedMonths.length));
  }, [viewScope, displayedMonths.length]);

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
      const avgRoi = getRecruiterAvgRoi(chNode);
      totalTarget += getRecruiterPeriodTarget(r);
      sumRecOffered += bucket.offered || 0;
      sumRecJoined += bucket.joined || 0;
      if (avgRoi >= roiTarget) metTargetCount++;
    });

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
  }, [activePerf, viewScope, roiTarget, getRecChannelData, getRecruiterAvgRoi, getRecruiterPeriodTarget, activeSheetTotals]);

  const selectedChannelLabel = useMemo(() => {
    const hit = REC_CHANNEL_OPTIONS.find((o) => o.key === channelScope);
    return hit ? hit.label : 'Overall (All Channels)';
  }, [channelScope]);

  const momByMonthMap = useMemo(() => {
    const map = {};
    (momSeries || []).forEach((item) => {
      if (item && item.month) map[item.month] = item;
    });
    return map;
  }, [momSeries]);

  const allListedRecruiterNames = useMemo(() => {
    return (activePerf.recruiters || []).map((r) => r.name);
  }, [activePerf]);

  const handleOpenRecModal = useCallback(({ recruiterName, recruiterNamesList, unlistedOnly, monthsList, metricType, labelPrefix }) => {
    if (!onOpenCandidateModal) return;
    const isOffered = metricType === 'momOffered';
    const rawPool = [];

    (monthsList || []).forEach((ym) => {
      const mItem = momByMonthMap[ym];
      if (!mItem) return;
      const list = isOffered ? (mItem.offeredCandidates || []) : (mItem.joinedCandidates || []);
      rawPool.push(...list);
    });

    const filtered = rawPool.filter((c) => {
      if (selectedBu !== 'all' && c.businessUnit !== selectedBu) return false;
      if (channelScope !== 'all' && normalizeCandidateChannelGroup(c.channel) !== channelScope) return false;

      if (unlistedOnly) {
        return !allListedRecruiterNames.some((rn) => recruiterNamesMatch(c.recruiter, rn));
      }
      if (Array.isArray(recruiterNamesList) && recruiterNamesList.length > 0) {
        return recruiterNamesList.some((rn) => recruiterNamesMatch(c.recruiter, rn));
      }
      if (recruiterName) {
        return recruiterNamesMatch(c.recruiter, recruiterName);
      }
      return true;
    });

    const subtitleParts = [
      selectedBu === 'all' ? 'All Business Units' : selectedBu,
      selectedChannelLabel,
    ];

    onOpenCandidateModal({
      title: `${labelPrefix} — ${isOffered ? 'Offered Candidates' : 'Joined Candidates'}`,
      subtitle: subtitleParts.join(' · '),
      candidates: filtered,
      metricType,
    });
  }, [onOpenCandidateModal, momByMonthMap, selectedBu, channelScope, selectedChannelLabel, allListedRecruiterNames]);

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
          fontSize: '11.5px',
          lineHeight: 1.3,
        }}
      >
        {val.toFixed(1)}x
      </span>
    );
  };

  return (
    <section
      className="panel rec-perf-panel"
      style={{
        marginTop: '28px',
        padding: '20px 22px',
        borderRadius: '12px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
        color: textColor,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <style jsx>{`
        .rec-compact-table th {
          padding: 8px 10px !important;
          font-size: 12px !important;
        }
        .rec-compact-table td {
          padding: 6px 10px !important;
          font-size: 12.5px !important;
          line-height: 1.25 !important;
          vertical-align: middle !important;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          paddingBottom: '16px',
          marginBottom: '14px',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ minWidth: '240px', flex: '1 1 auto' }}>
          <p className="kicker" style={{ marginBottom: '2px', fontSize: '11px' }}>Recruiter Efficiency & ROI</p>
          <h2 style={{ margin: 0, fontSize: '21px', lineHeight: 1.2 }}>Recruiter Performance</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '12.5px' }}>
            {selectedBu === 'all' ? 'All Business Units' : selectedBu} · {selectedChannelLabel} · Monthly Target: <b>{roiTarget}x ROI</b> · Quarterly Target: <b>{roiTarget}x Avg ROI</b>
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '6px 14px',
              minHeight: '42px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.03em' }}>
              {viewScope === 'qtd' ? 'QTD Master Offered / Joined' : 'Overall Master Offered / Joined'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <RecClickPill
                value={summaryKpis.totalOffered}
                color="#38bdf8"
                title="Click to view all Master Offered candidates for this period"
                onClick={() =>
                  handleOpenRecModal({
                    monthsList: displayedMonths,
                    metricType: 'momOffered',
                    labelPrefix: `${viewScope === 'qtd' ? 'QTD' : 'Overall'} Master Offered`,
                  })
                }
              />
              <span style={{ color: mutedColor, fontWeight: 600 }}>/</span>
              <RecClickPill
                value={summaryKpis.totalJoined}
                color="#10b981"
                title="Click to view all Joined candidates for this period"
                onClick={() =>
                  handleOpenRecModal({
                    monthsList: displayedMonths,
                    metricType: 'momJoined',
                    labelPrefix: `${viewScope === 'qtd' ? 'QTD' : 'Overall'} Master Joined`,
                  })
                }
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '6px 14px',
              minHeight: '42px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#eab308', fontWeight: 700, letterSpacing: '0.03em' }}>
              ≥ {roiTarget}x Avg ROI Achieved
            </span>
            <strong style={{ fontSize: '15px', color: '#eab308', lineHeight: 1.2, marginTop: '2px' }}>
              {summaryKpis.metTargetCount} / {summaryKpis.totalRecruiters}
            </strong>
          </div>

          <select
            value={channelScope}
            onChange={(e) => setChannelScope(e.target.value)}
            aria-label="Filter Recruiter Performance by Channel"
            style={{
              height: '42px',
              maxWidth: '100%',
              padding: '0 12px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              border: '1px solid rgba(56, 189, 248, 0.55)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            {REC_CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} style={{ background: '#0f172a', color: '#fff' }}>
                Channel: {opt.label}
              </option>
            ))}
          </select>

          <select
            value={viewScope}
            onChange={(e) => setViewScope(e.target.value)}
            aria-label="Recruiter performance period"
            style={{
              height: '42px',
              maxWidth: '100%',
              padding: '0 12px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              border: '1px solid rgba(234, 179, 8, 0.65)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <option value="qtd" style={{ background: '#0f172a', color: '#fff' }}>Current Quarter (QTD · Avg ROI)</option>
            <option value="overall" style={{ background: '#0f172a', color: '#fff' }}>Overall (MoM Matrix · Avg ROI)</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          padding: '7px 12px',
          marginBottom: '12px',
          borderRadius: '8px',
          background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.025)',
          border: `1px solid ${borderColor}`,
          fontSize: '11.5px',
          color: mutedColor,
        }}
      >
        <strong style={{ color: textColor }}>ROI Channel Weights:</strong>
        <span><b style={{ color: '#10b981' }}>100%</b> Internal (Internal, Careers Page, Campus)</span>
        <span><b style={{ color: '#eab308' }}>20%</b> Employee Referral · Business Reference</span>
        <span><b style={{ color: '#f87171' }}>0%</b> External & Interns</span>
        <span style={{ marginLeft: 'auto' }}>
          Monthly Target: <b style={{ color: textColor }}>{roiTarget}x</b> · Quarterly Avg Target: <b style={{ color: textColor }}>{roiTarget}x Avg</b> · <span style={{ color: '#38bdf8' }}>Click any Offer/Join count for details</span>
        </span>
      </div>

      {groupedRecruiters.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
          No recruiters found. Make sure the <b>Recruiters</b> tab is populated and published from the sheet.
        </p>
      ) : (
        <div className="table-scroll" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="jobs rec-compact-table" style={{ margin: 0, width: '100%', minWidth: `${Math.max(900, 530 + displayedMonths.length * 125)}px` }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: theme === 'light' ? '#e2e8f0' : '#1e293b' }}>Recruiter Name</th>
                <th className="n">
                  {viewScope === 'qtd' ? 'Qtr Target (×3)' : 'Target (Joinings)'}
                </th>
                {displayedMonths.map((ym) => (
                  <th key={ym} className="n" style={{ minWidth: '118px' }}>
                    {formatYearMonth(ym)}
                    <div style={{ fontSize: '10px', fontWeight: 500, opacity: 0.75 }}>Off / Join · ROI ({roiTarget}x)</div>
                  </th>
                ))}
                <th className="n">
                  {viewScope === 'qtd' ? 'QTD (Off / Join)' : 'Total (Off / Join)'}
                </th>
                <th className="n">Target Attainment</th>
                <th className="n">{viewScope === 'qtd' ? `QTD Avg ROI (${roiTarget}x)` : `Avg ROI (${roiTarget}x)`}</th>
                <th className="n">{roiTarget}x Avg Status</th>
              </tr>
            </thead>
            <tbody>
              {groupedRecruiters.map((group) => {
                let groupTarget = 0;
                let groupOffered = 0;
                let groupJoined = 0;
                let groupRoiSum = 0;
                const groupRecNames = group.items.map((item) => item.name);

                return (
                  <Fragment key={group.key}>
                    <tr
                      style={{
                        background: theme === 'light' ? '#f1f5f9' : 'rgba(56, 189, 248, 0.08)',
                      }}
                    >
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: theme === 'light' ? '#f1f5f9' : '#132338',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: group.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {group.label} ({group.items.length})
                      </td>
                      <td colSpan={5 + displayedMonths.length} />
                    </tr>

                    {group.items.map((r) => {
                      const chNode = getRecChannelData(r);
                      const periodStats = viewScope === 'qtd' ? (chNode.qtd || {}) : (chNode.overall || {});
                      const offered = periodStats.offered || 0;
                      const joined = periodStats.joined || 0;
                      const avgRoi = getRecruiterAvgRoi(chNode);
                      const monthlyTarget = Number(r.monthlyTarget ?? r.target ?? 0);
                      const target = getRecruiterPeriodTarget(r);
                      const attainmentPct = target > 0 ? Math.round((joined / target) * 100) : 0;
                      const roiGap = Math.max(0, Math.round((roiTarget - avgRoi) * 10) / 10);

                      groupTarget += target;
                      groupOffered += offered;
                      groupJoined += joined;
                      groupRoiSum += avgRoi;

                      return (
                        <tr key={`${group.key}-${r.name}`}>
                          <td
                            style={{
                              fontWeight: 600,
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              background: theme === 'light' ? '#ffffff' : '#0f172a',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.name}
                          </td>

                          <td className="n" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {target > 0 ? (
                              <span>
                                {fmt(target)}{' '}
                                <span style={{ fontSize: '11px', color: mutedColor, fontWeight: 400 }}>
                                  ({fmt(monthlyTarget)}/mo)
                                </span>
                              </span>
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
                                  <span style={{ color: mutedColor, opacity: 0.4 }}>—</span>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <RecClickPill
                                      value={mOff}
                                      color="#38bdf8"
                                      title={`View ${r.name}'s offered candidates in ${formatYearMonth(ym)}`}
                                      onClick={() =>
                                        handleOpenRecModal({
                                          recruiterName: r.name,
                                          monthsList: [ym],
                                          metricType: 'momOffered',
                                          labelPrefix: `${r.name} (${formatYearMonth(ym)})`,
                                        })
                                      }
                                    />
                                    <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                                    <RecClickPill
                                      value={mJoin}
                                      color="#10b981"
                                      title={`View ${r.name}'s joined candidates in ${formatYearMonth(ym)}`}
                                      onClick={() =>
                                        handleOpenRecModal({
                                          recruiterName: r.name,
                                          monthsList: [ym],
                                          metricType: 'momJoined',
                                          labelPrefix: `${r.name} (${formatYearMonth(ym)})`,
                                        })
                                      }
                                    />
                                    <span
                                      style={{
                                        fontSize: '10.5px',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        background: mRoi >= roiTarget ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.07)',
                                        color: mRoi >= roiTarget ? '#10b981' : mutedColor,
                                        fontWeight: 600,
                                        marginLeft: '2px',
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
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <RecClickPill
                                value={offered}
                                color="#38bdf8"
                                title={`View all ${viewScope === 'qtd' ? 'QTD' : 'Overall'} offered candidates for ${r.name}`}
                                onClick={() =>
                                  handleOpenRecModal({
                                    recruiterName: r.name,
                                    monthsList: displayedMonths,
                                    metricType: 'momOffered',
                                    labelPrefix: `${r.name} (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                                  })
                                }
                              />
                              <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                              <RecClickPill
                                value={joined}
                                color="#10b981"
                                title={`View all ${viewScope === 'qtd' ? 'QTD' : 'Overall'} joined candidates for ${r.name}`}
                                onClick={() =>
                                  handleOpenRecModal({
                                    recruiterName: r.name,
                                    monthsList: displayedMonths,
                                    metricType: 'momJoined',
                                    labelPrefix: `${r.name} (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                                  })
                                }
                              />
                            </div>
                          </td>

                          <td className="n" style={{ whiteSpace: 'nowrap' }}>
                            {target > 0 ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: 600 }}>
                                  {fmt(joined)}/{fmt(target)} ({attainmentPct}%)
                                </span>
                                <div style={{ width: '54px', height: '5px', background: 'rgba(148,163,184,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
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

                          <td className="n">{renderRoiBadge(avgRoi, roiTarget)}</td>

                          <td className="n" style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                            {avgRoi >= roiTarget ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Achieved ({avgRoi.toFixed(1)}x)</span>
                            ) : (
                              <span style={{ color: '#eab308', fontWeight: 500 }}>Needs +{roiGap.toFixed(1)}x to {roiTarget}x</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    <tr style={{ fontWeight: 700, background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.025)' }}>
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
                          <td key={ym} className="n" style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <RecClickPill
                                value={mOffSum}
                                color="#38bdf8"
                                onClick={() =>
                                  handleOpenRecModal({
                                    recruiterNamesList: groupRecNames,
                                    monthsList: [ym],
                                    metricType: 'momOffered',
                                    labelPrefix: `${group.key} Subtotal (${formatYearMonth(ym)})`,
                                  })
                                }
                              />
                              <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                              <RecClickPill
                                value={mJoinSum}
                                color="#10b981"
                                onClick={() =>
                                  handleOpenRecModal({
                                    recruiterNamesList: groupRecNames,
                                    monthsList: [ym],
                                    metricType: 'momJoined',
                                    labelPrefix: `${group.key} Subtotal (${formatYearMonth(ym)})`,
                                  })
                                }
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="n" style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <RecClickPill
                            value={groupOffered}
                            color="#38bdf8"
                            onClick={() =>
                              handleOpenRecModal({
                                recruiterNamesList: groupRecNames,
                                monthsList: displayedMonths,
                                metricType: 'momOffered',
                                labelPrefix: `${group.key} Subtotal (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                              })
                            }
                          />
                          <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                          <RecClickPill
                            value={groupJoined}
                            color="#10b981"
                            onClick={() =>
                              handleOpenRecModal({
                                recruiterNamesList: groupRecNames,
                                monthsList: displayedMonths,
                                metricType: 'momJoined',
                                labelPrefix: `${group.key} Subtotal (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="n">
                        {groupTarget > 0 ? `${Math.round((groupJoined / groupTarget) * 100)}%` : '—'}
                      </td>
                      <td className="n">
                        {group.items.length > 0
                          ? renderRoiBadge(Math.round((groupRoiSum / group.items.length) * 10) / 10, roiTarget)
                          : '—'}
                      </td>
                      <td className="n">—</td>
                    </tr>
                  </Fragment>
                );
              })}

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
                  <td className="n">—</td>
                  {displayedMonths.map((ym) => {
                    const uStat = (activeSheetTotals.unlistedByMonth && activeSheetTotals.unlistedByMonth[ym]) || { offered: 0, joined: 0 };
                    return (
                      <td key={ym} className="n" style={{ whiteSpace: 'nowrap' }}>
                        {uStat.offered === 0 && uStat.joined === 0 ? (
                          '—'
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <RecClickPill
                              value={uStat.offered}
                              color="#38bdf8"
                              onClick={() =>
                                handleOpenRecModal({
                                  unlistedOnly: true,
                                  monthsList: [ym],
                                  metricType: 'momOffered',
                                  labelPrefix: `Former / Unlisted Recruiters (${formatYearMonth(ym)})`,
                                })
                              }
                            />
                            <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                            <RecClickPill
                              value={uStat.joined}
                              color="#10b981"
                              onClick={() =>
                                handleOpenRecModal({
                                  unlistedOnly: true,
                                  monthsList: [ym],
                                  metricType: 'momJoined',
                                  labelPrefix: `Former / Unlisted Recruiters (${formatYearMonth(ym)})`,
                                })
                              }
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="n" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <RecClickPill
                        value={summaryKpis.unlistedOffered}
                        color="#38bdf8"
                        onClick={() =>
                          handleOpenRecModal({
                            unlistedOnly: true,
                            monthsList: displayedMonths,
                            metricType: 'momOffered',
                            labelPrefix: `Former / Unlisted Recruiters (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                          })
                        }
                      />
                      <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                      <RecClickPill
                        value={summaryKpis.unlistedJoined}
                        color="#10b981"
                        onClick={() =>
                          handleOpenRecModal({
                            unlistedOnly: true,
                            monthsList: displayedMonths,
                            metricType: 'momJoined',
                            labelPrefix: `Former / Unlisted Recruiters (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                          })
                        }
                      />
                    </div>
                  </td>
                  <td className="n">—</td>
                  <td className="n">—</td>
                  <td className="n">—</td>
                </tr>
              )}
            </tbody>

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
                <td className="n">{fmt(summaryKpis.totalTarget)}</td>
                {displayedMonths.map((ym) => {
                  const dMonth = (activeSheetTotals.byMonth && activeSheetTotals.byMonth[ym]) || { offered: 0, joined: 0 };
                  return (
                    <td key={ym} className="n" style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <RecClickPill
                          value={dMonth.offered}
                          color="#38bdf8"
                          onClick={() =>
                            handleOpenRecModal({
                              monthsList: [ym],
                              metricType: 'momOffered',
                              labelPrefix: `Master Offered Total (${formatYearMonth(ym)})`,
                            })
                          }
                        />
                        <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                        <RecClickPill
                          value={dMonth.joined}
                          color="#10b981"
                          onClick={() =>
                            handleOpenRecModal({
                              monthsList: [ym],
                              metricType: 'momJoined',
                              labelPrefix: `Master Joined Total (${formatYearMonth(ym)})`,
                            })
                          }
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="n" style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <RecClickPill
                      value={summaryKpis.totalOffered}
                      color="#38bdf8"
                      onClick={() =>
                        handleOpenRecModal({
                          monthsList: displayedMonths,
                          metricType: 'momOffered',
                          labelPrefix: `Master Offered Total (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                        })
                      }
                    />
                    <span style={{ color: mutedColor, fontSize: '11px' }}>/</span>
                    <RecClickPill
                      value={summaryKpis.totalJoined}
                      color="#10b981"
                      onClick={() =>
                        handleOpenRecModal({
                          monthsList: displayedMonths,
                          metricType: 'momJoined',
                          labelPrefix: `Master Joined Total (${viewScope === 'qtd' ? 'QTD' : 'Overall'})`,
                        })
                      }
                    />
                  </div>
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

function JobHealthBadge({ health }) {
  const h = norm(health);
  if (!h || h === '—' || h === '-') return <span>—</span>;

  let bg = 'rgba(148, 163, 184, 0.15)';
  let border = 'rgba(148, 163, 184, 0.4)';
  let color = '#94a3b8';

  if (h.includes('track')) {
    bg = 'rgba(16, 185, 129, 0.16)';
    border = 'rgba(16, 185, 129, 0.5)';
    color = '#10b981';
  } else if (h.includes('delay')) {
    bg = 'rgba(234, 179, 8, 0.16)';
    border = 'rgba(234, 179, 8, 0.5)';
    color = '#eab308';
  } else if (h.includes('critical') || h.includes('crit')) {
    bg = 'rgba(239, 68, 68, 0.16)';
    border = 'rgba(239, 68, 68, 0.5)';
    color = '#f87171';
  } else if (h.includes('close')) {
    bg = 'rgba(148, 163, 184, 0.14)';
    border = 'rgba(148, 163, 184, 0.35)';
    color = '#94a3b8';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        background: bg,
        border: `1px solid ${border}`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {health}
    </span>
  );
}

/* ---------- Expandable Business Unit Jobs Table (Job Health Column Removed) ---------- */

function BuJobsRow({ buLabel, allJobs, onOpenJobModal, theme }) {
  const buJobs = useMemo(() => {
    return (allJobs || []).filter((j) => j.businessUnit === buLabel).sort((a, b) => norm(a.department).localeCompare(norm(b.department)));
  }, [buLabel, allJobs]);

  if (!buJobs.length) return null;

  return (
    <tr>
      <td colSpan={17} style={{ padding: '14px 18px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '2px solid rgba(128,128,128,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#eab308', letterSpacing: '0.02em' }}>
            {buLabel} — {fmt(buJobs.length)} Jobs (Sorted by Department)
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.28)', border: '1px solid #f59e0b', display: 'inline-block' }} />
            Highlighted row = Replacement Role
          </div>
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
              {buJobs.map((j, idx) => {
                const isReplacementRole =
                  Boolean(j.isReplacement) ||
                  Number(j.replacement) > 0 ||
                  norm(j.category).includes('replace');

                const repRowStyle = isReplacementRole
                  ? {
                      background: theme === 'light' ? 'rgba(254, 243, 199, 0.85)' : 'rgba(245, 158, 11, 0.16)',
                      boxShadow: 'inset 4px 0 0 #f59e0b',
                    }
                  : undefined;

                return (
                  <tr key={`${j.unitKey || 'u'}-${j.jobId}-${j.role || ''}-${j.department || ''}-${idx}`} style={repRowStyle}>
                    <td style={{ fontWeight: 600 }}>{j.department || '—'}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                      <span style={isReplacementRole ? { color: '#fbbf24', fontWeight: 700 } : undefined}>
                        {j.jobId}
                      </span>
                      {isReplacementRole && (
                        <span
                          title="Replacement Position"
                          style={{
                            marginLeft: '6px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: 'rgba(245, 158, 11, 0.25)',
                            border: '1px solid rgba(245, 158, 11, 0.6)',
                            color: theme === 'light' ? '#b45309' : '#fde68a',
                            verticalAlign: 'middle',
                          }}
                        >
                          REPLACEMENT{Number(j.replacement) > 1 ? ` (${j.replacement})` : ''}
                        </span>
                      )}
                    </td>
                    <td>{j.role || '—'}</td>
                    <td>{j.category || '—'}</td>
                    <td>{j.status && j.status !== '—' ? <StatusBadge status={j.status} /> : '—'}</td>
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
                );
              })}
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
  const [showPositionsSplitModal, setShowPositionsSplitModal] = useState(false);
  const [showPendingHealthModal, setShowPendingHealthModal] = useState(false);
  const [showCvLess5Modal, setShowCvLess5Modal] = useState(false);
  
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

  const cvLess5Jobs = useMemo(() => {
    if (!data || !Array.isArray(data.jobs)) return [];
    return data.jobs.filter((j) => {
      if (j.isManualForm) return false;
      if (bu !== 'all' && j.businessUnit !== bu) return false;
      return Boolean(j.cvLess5);
    });
  }, [data, bu]);

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
            @media (max-width: 768px) {
              .wrap, .top-inner {
                padding-left: 14px !important;
                padding-right: 14px !important;
              }
            }
            .table-scroll {
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch;
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
                  <div>
                    <span>Open roles</span>
                    <b>{fmt(kpi.openRoles)}</b>
                    {kpi.needToClose > 0 && <small>{fmt(kpi.needToClose)} need to close</small>}
                  </div>

                  {/* Clickable Total Positions KPI Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowPositionsSplitModal(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowPositionsSplitModal(true);
                      }
                    }}
                    title="Click to view split between Ad-Hoc, Monthly Approved & Last Month C/F"
                    style={{
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span>Total positions</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: 'rgba(56, 189, 248, 0.16)',
                          border: '1px solid rgba(56, 189, 248, 0.45)',
                          color: '#38bdf8',
                          textTransform: 'uppercase',
                        }}
                      >
                        View Split
                      </span>
                    </span>
                    <b style={{ color: '#38bdf8', textDecoration: 'underline', textDecorationColor: 'rgba(56, 189, 248, 0.45)', textUnderlineOffset: '4px' }}>
                      {fmt(kpi.total)}
                    </b>
                    <small style={{ color: '#94a3b8' }}>
                      Click for Ad-Hoc · Approved · C/F
                    </small>
                  </div>

                  <div><span>Yet to offer</span><b>{fmt(kpi.yetToOffer)}</b></div>
                  <div><span>Offered</span><b>{fmt(kpi.offered)}</b></div>
                  <div><span>Joined</span><b>{fmt(kpi.joined)}</b></div>

                  {/* Clickable Pending Positions KPI Card (Split by Job Health: On Track, Delayed, Critical) */}
                  <div
                    className="hl"
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowPendingHealthModal(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowPendingHealthModal(true);
                      }
                    }}
                    title="Click to view Pending Positions split by Job Health (On Track, Delayed, Critical)"
                    style={{
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span>Pending positions</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: 'rgba(234, 179, 8, 0.22)',
                          border: '1px solid rgba(234, 179, 8, 0.55)',
                          color: '#eab308',
                          textTransform: 'uppercase',
                        }}
                      >
                        Job Health
                      </span>
                    </span>
                    <b style={{ color: '#fde047', textDecoration: 'underline', textDecorationColor: 'rgba(234, 179, 8, 0.5)', textUnderlineOffset: '4px' }}>
                      {fmt(kpi.pending)}
                    </b>
                    <small style={{ color: '#eab308' }}>
                      Click for On Track · Delayed · Critical
                    </small>
                  </div>
                </section>

                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <h2 style={{ margin: 0 }}>Manpower by Business Unit</h2>

                    {/* CV < 5 Checker Button */}
                    <button
                      type="button"
                      onClick={() => setShowCvLess5Modal(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: cvLess5Jobs.length > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(148, 163, 184, 0.12)',
                        border: cvLess5Jobs.length > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)',
                        color: cvLess5Jobs.length > 0 ? '#f87171' : 'inherit',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      <span>Jobs with &lt; 5 CVs</span>
                      <span
                        style={{
                          padding: '2px 9px',
                          borderRadius: '999px',
                          background: cvLess5Jobs.length > 0 ? '#ef4444' : 'rgba(148, 163, 184, 0.25)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '12px',
                        }}
                      >
                        {fmt(cvLess5Jobs.length)}
                      </span>
                    </button>
                  </div>

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
                                  <BuJobsRow buLabel={b.label} allJobs={datasets.mu.jobs} onOpenJobModal={openJobModal} theme={theme} />
                                )}
                              </Fragment>
                            ))}
                            {muTotals && (
                              <tr
                                className="bu-subtotal-row mu-subtotal"
                                style={{
                                  fontWeight: 700,
                                  background: theme === 'light' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.18)',
                                  boxShadow: 'inset 4px 0 0 #10b981',
                                  borderTop: '1px solid rgba(16, 185, 129, 0.4)',
                                  borderBottom: '2px solid rgba(16, 185, 129, 0.45)',
                                }}
                              >
                                <td style={{ color: theme === 'light' ? '#047857' : '#34d399', fontWeight: 800, letterSpacing: '0.02em' }}>
                                  Subtotal · Masters’ Union
                                </td>
                                <td className="n" style={{ color: theme === 'light' ? '#065f46' : '#ecfdf5', fontWeight: 800 }}>{fmt(muTotals.openRoles)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#065f46' : '#ecfdf5', fontWeight: 800 }}>{fmt(muTotals.total)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#065f46' : '#ecfdf5', fontWeight: 800 }}>{fmt(muTotals.yetToOffer)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#065f46' : '#ecfdf5', fontWeight: 800 }}>{fmt(muTotals.offered)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#065f46' : '#ecfdf5', fontWeight: 800 }}>{fmt(muTotals.joined)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#047857' : '#34d399', fontWeight: 800 }}>{fmt(muTotals.pending)}</td>
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
                                  <BuJobsRow buLabel={b.label} allJobs={datasets.tetr.jobs} onOpenJobModal={openJobModal} theme={theme} />
                                )}
                              </Fragment>
                            ))}
                            {tetrTotals && (
                              <tr
                                className="bu-subtotal-row tetr-subtotal"
                                style={{
                                  fontWeight: 700,
                                  background: theme === 'light' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(56, 189, 248, 0.18)',
                                  boxShadow: 'inset 4px 0 0 #38bdf8',
                                  borderTop: '1px solid rgba(56, 189, 248, 0.4)',
                                  borderBottom: '2px solid rgba(56, 189, 248, 0.45)',
                                }}
                              >
                                <td style={{ color: theme === 'light' ? '#0369a1' : '#38bdf8', fontWeight: 800, letterSpacing: '0.02em' }}>
                                  Subtotal · TETR
                                </td>
                                <td className="n" style={{ color: theme === 'light' ? '#0c4a6e' : '#f0f9ff', fontWeight: 800 }}>{fmt(tetrTotals.openRoles)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#0c4a6e' : '#f0f9ff', fontWeight: 800 }}>{fmt(tetrTotals.total)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#0c4a6e' : '#f0f9ff', fontWeight: 800 }}>{fmt(tetrTotals.yetToOffer)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#0c4a6e' : '#f0f9ff', fontWeight: 800 }}>{fmt(tetrTotals.offered)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#0c4a6e' : '#f0f9ff', fontWeight: 800 }}>{fmt(tetrTotals.joined)}</td>
                                <td className="n" style={{ color: theme === 'light' ? '#0369a1' : '#38bdf8', fontWeight: 800 }}>{fmt(tetrTotals.pending)}</td>
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
                                <BuJobsRow buLabel={b.label} allJobs={data.jobs} onOpenJobModal={openJobModal} theme={theme} />
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

                <RecruiterPerformanceSection
                  recruiterPerformance={data.recruiterPerformance}
                  recruiterPerformanceByBu={data.recruiterPerformanceByBu}
                  momSeries={data.momSeries || []}
                  selectedBu={bu}
                  theme={theme}
                  onOpenCandidateModal={setModalData}
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

          <TotalPositionsModal
            open={showPositionsSplitModal}
            onClose={() => setShowPositionsSplitModal(false)}
            scopeBUs={scopeBUs}
            kpi={kpi}
            selectedBu={bu}
            unitTitle={currentMeta.title}
            theme={theme}
          />

          <PendingPositionsModal
            open={showPendingHealthModal}
            onClose={() => setShowPendingHealthModal(false)}
            scopeBUs={scopeBUs}
            allJobs={data ? data.jobs : []}
            kpi={kpi}
            selectedBu={bu}
            unitTitle={currentMeta.title}
            theme={theme}
          />

          <CvLess5Modal
            open={showCvLess5Modal}
            onClose={() => setShowCvLess5Modal(false)}
            jobs={cvLess5Jobs}
            selectedBu={bu}
            unitTitle={currentMeta.title}
            theme={theme}
          />

          {modalData && (
            <CandidateModal modalData={modalData} onClose={() => setModalData(null)} />
          )}
        </div>
      )}
    </AccessGate>
  );
}