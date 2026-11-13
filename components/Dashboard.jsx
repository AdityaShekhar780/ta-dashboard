'use client';

'use client';

import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';

const UNIT_KEYS = ['overall', 'mu', 'tetr'];

const CHANNEL_ORDER = [
  'Internal',
  'Employee Referrals',
  'Business Reference',
  'Campus',
  'Careers Page',
  'External',
];

const CHANNEL_COLORS = {
  Internal: '#38bdf8',
  'Employee Referrals': '#10b981',
  'Business Reference': '#a78bfa',
  Campus: '#f59e0b',
  'Careers Page': '#34d399',
  External: '#f87171',
};

const FUNNEL_STAGE_GROUPS = [
  {
    stage: 'TA Round',
    rows: [
      { key: 'tof', label: 'ToF' },
      { key: 'taShortlist', label: 'TA Shortlist' },
      { key: 'resumeShortlist', label: 'Resume Shortlist' },
    ],
  },
  {
    stage: '1st Round',
    rows: [
      { key: 'r1Tof', label: 'R1 Interview ToF' },
      { key: 'r1Shortlist', label: 'R1 Shortlist' },
      { key: 'r1Reject', label: 'R1 Reject' },
      { key: 'r1NotRated', label: 'R1 Not Rated' },
    ],
  },
  {
    stage: '2nd Round',
    rows: [
      { key: 'r2Tof', label: 'R2 Interview ToF' },
      { key: 'r2Shortlist', label: 'R2 Shortlist' },
      { key: 'r2Reject', label: 'R2 Reject' },
      { key: 'r2NotRated', label: 'R2 Not Rated' },
    ],
  },
  {
    stage: '3rd Round',
    rows: [
      { key: 'r3Tof', label: 'R3 Interview ToF' },
      { key: 'r3Shortlist', label: 'R3 Shortlist' },
      { key: 'r3Reject', label: 'R3 Reject' },
      { key: 'r3NotRated', label: 'R3 Not Rated' },
    ],
  },
  {
    stage: 'Offers',
    rows: [
      { key: 'offered', label: 'Offered' },
      { key: 'offeredCurrentJoining', label: 'Offered (Current month Joining)' },
    ],
  },
  {
    stage: 'Joining Stage',
    rows: [
      { key: 'joined', label: 'Joined' },
      { key: 'offerDrop', label: 'Offer Drop' },
    ],
  },
];

const BIFURCATION_GROUPS = [
  {
    stage: 'Channel',
    headerBanner: 'Joining Bifurcation',
    showNonInternalPctRow: true,
    rows: [
      { key: 'chInternal', label: 'Internal' },
      { key: 'chCampus', label: 'Campus' },
      { key: 'chEmpReferral', label: 'Employee Referral' },
      { key: 'chBusReference', label: 'Business Reference' },
      { key: 'chExternal', label: 'External' },
    ],
  },
  {
    stage: 'Source',
    headerBanner: 'Internal Source Split',
    rows: [
      { key: 'srcNaukri', label: 'Naukri' },
      { key: 'srcLinkedin', label: 'LinkedIn' },
      { key: 'srcIndeed', label: 'Indeed' },
      { key: 'srcOthers', label: 'Others' },
    ],
  },
  {
    stage: 'Employment Type',
    rows: [
      { key: 'empFulltime', label: 'Fulltime' },
      { key: 'empContract', label: 'Contract' },
      { key: 'empIntern', label: 'Intern' },
    ],
  },
  {
    stage: 'Category',
    rows: [
      { key: 'catA', label: 'A' },
      { key: 'catB', label: 'B' },
      { key: 'catC', label: 'C' },
    ],
  },
];

const STAGE_ACCENTS = {
  'TA Round': { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)' },
  '1st Round': { color: '#818cf8', bg: 'rgba(129, 140, 248, 0.1)', border: 'rgba(129, 140, 248, 0.3)' },
  '2nd Round': { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)', border: 'rgba(167, 139, 250, 0.3)' },
  '3rd Round': { color: '#f472b6', bg: 'rgba(244, 114, 182, 0.1)', border: 'rgba(244, 114, 182, 0.3)' },
  Offers: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)' },
  'Joining Stage': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' },
  Channel: { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)' },
  Source: { color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.3)' },
  'Employment Type': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
  Category: { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.1)', border: 'rgba(192, 132, 252, 0.3)' },
};

/* ---------- Formatting & Helper Utilities ---------- */

function fmt(n) {
  const x = Number(n || 0);
  return isFinite(x) ? x.toLocaleString('en-IN') : '0';
}

function pct(part, total) {
  const p = Number(part || 0);
  const t = Number(total || 0);
  if (!t || t <= 0) return '0.0%';
  return `${((p / t) * 100).toFixed(1)}%`;
}

function norm(s) {
  return String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatYearMonth(ym) {
  if (!ym || typeof ym !== 'string') return ym || '';
  const parts = ym.split('-');
  if (parts.length !== 2) return ym;
  const yr = parts[0].slice(-2);
  const moIdx = parseInt(parts[1], 10) - 1;
  const mos = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${mos[moIdx] || parts[1]}-${yr}`;
}

function generateMonthSequence(startYm, endYm) {
  const [sY, sM] = startYm.split('-').map(Number);
  const [eY, eM] = endYm.split('-').map(Number);
  const out = [];
  let y = sY;
  let m = sM;
  while (y < eY || (y === eY && m <= eM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function formatInrShort(val) {
  const n = Number(val || 0);
  if (!isFinite(n) || n === 0) return 'â‚¹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) {
    return `â‚¹${(n / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `â‚¹${(n / 100000).toFixed(2)} L`;
  }
  return `â‚¹${Math.round(n).toLocaleString('en-IN')}`;
}

function formatInrFull(val) {
  const n = Math.round(Number(val || 0));
  if (!isFinite(n) || n === 0) return 'â‚¹0';
  return `â‚¹${n.toLocaleString('en-IN')}`;
}

function mergeFunnelMonthMaps(mapA, mapB) {
  const out = {};
  const keys = new Set([...Object.keys(mapA || {}), ...Object.keys(mapB || {})]);
  keys.forEach((ym) => {
    const a = (mapA && mapA[ym]) || {};
    const b = (mapB && mapB[ym]) || {};
    const mKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const merged = {};
    mKeys.forEach((k) => {
      merged[k] = Number(a[k] || 0) + Number(b[k] || 0);
    });
    out[ym] = merged;
  });
  return out;
}

function mergeCountMaps(mapA, mapB) {
  const out = { ...(mapA || {}) };
  Object.keys(mapB || {}).forEach((k) => {
    out[k] = Number(out[k] || 0) + Number(mapB[k] || 0);
  });
  return out;
}

function mergeEffMaps(mapA, mapB) {
  const out = {};
  const keys = new Set([...Object.keys(mapA || {}), ...Object.keys(mapB || {})]);
  keys.forEach((ch) => {
    const a = (mapA && mapA[ch]) || { applied: 0, joined: 0 };
    const b = (mapB && mapB[ch]) || { applied: 0, joined: 0 };
    out[ch] = {
      applied: Number(a.applied || 0) + Number(b.applied || 0),
      joined: Number(a.joined || 0) + Number(b.joined || 0),
    };
  });
  return out;
}

function getJobHealthBadgeStyle(health) {
  const h = norm(health);
  if (h === 'on track') {
    return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.38)' };
  }
  if (h === 'delayed') {
    return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.14)', border: 'rgba(234, 179, 8, 0.38)' };
  }
  if (h === 'critical') {
    return { color: '#f87171', bg: 'rgba(248, 113, 113, 0.14)', border: 'rgba(248, 113, 113, 0.38)' };
  }
  return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' };
}

/* ---------- Access Gate ---------- */

function AccessGate({ children, theme }) {
  const [allowedUsers, setAllowedUsers] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let saved = '';
    try {
      saved = localStorage.getItem('ta_dashboard_email') || '';
    } catch (e) {
      saved = '';
    }

    fetch(`/data/access.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((json) => {
        const list = Array.isArray(json.users) ? json.users : [];
        setAllowedUsers(list);
        if (list.length === 0) {
          setVerifiedUser({ name: 'Viewer', email: '' });
          return;
        }
        if (saved) {
          const hit = list.find((u) => norm(u.email) === norm(saved));
          if (hit) setVerifiedUser(hit);
        }
      })
      .catch(() => {
        setAllowedUsers([]);
        setVerifiedUser({ name: 'Viewer', email: '' });
      });
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const clean = norm(emailInput);
    if (!clean) return;
    const hit = (allowedUsers || []).find((u) => norm(u.email) === clean);
    if (hit) {
      try {
        localStorage.setItem('ta_dashboard_email', hit.email);
      } catch (err) {}
      setVerifiedUser(hit);
      setErrorMsg('');
    } else {
      setErrorMsg('This email is not on the Access list in the Google Sheet.');
    }
  };

  if (allowedUsers === null) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        Checking access permissionsâ€¦
      </div>
    );
  }

  if (!verifiedUser) {
    return (
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '28px',
            borderRadius: '14px',
            background: theme === 'light' ? '#ffffff' : '#111827',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          }}
        >
          <p
            className="kicker"
            style={{
              margin: '0 0 6px',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Talent Acquisition Analytics
          </p>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Sign in to view Dashboard</h2>
          <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#94a3b8' }}>
            Enter your work email listed in the Google Sheet <code>Access</code> tab.
          </p>
          <input
            type="email"
            required
            placeholder="name@mastersunion.org"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(56,189,248,0.4)',
              background: theme === 'light' ? '#f8fafc' : '#0f172a',
              color: 'inherit',
              fontSize: '14px',
              marginBottom: '12px',
              boxSizing: 'border-box',
            }}
          />
          {errorMsg && (
            <p style={{ color: '#f87171', fontSize: '12.5px', margin: '0 0 12px' }}>{errorMsg}</p>
          )}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#0284c7',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return children;
}

/* ---------- Modals: Total Positions, Pending Positions, CV < 5 & Job Candidates ---------- */

function TotalPositionsModal({ isOpen, onClose, businessUnits, unitName, theme }) {
  if (!isOpen) return null;

  const totalPos = businessUnits.reduce((s, b) => s + (b.manpower?.total || 0), 0);
  const adHoc = businessUnits.reduce((s, b) => s + (b.manpower?.adHoc || 0), 0);
  const monthlyApproved = businessUnits.reduce((s, b) => s + (b.manpower?.monthlyApproved || 0), 0);
  const lastMonthCf = businessUnits.reduce((s, b) => s + (b.manpower?.lastMonthCf || 0), 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: '14px',
          padding: '22px',
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f8fafc',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <p
              className="kicker"
              style={{ margin: 0, color: '#eab308', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}
            >
              Total Positions Bifurcation
            </p>
            <h3 style={{ margin: '4px 0 0', fontSize: '19px' }}>
              {unitName} â€” {fmt(totalPos)} Total Positions
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'inherit',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            âœ•
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8' }}>
              Ad-Hoc (Col G)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{fmt(adHoc)}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{pct(adHoc, totalPos)} of total</div>
          </div>
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#10b981' }}>
              Monthly Approved (Col H)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
              {fmt(monthlyApproved)}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{pct(monthlyApproved, totalPos)} of total</div>
          </div>
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#eab308' }}>
              Last Month C/F (Col I)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#eab308', marginTop: '4px' }}>
              {fmt(lastMonthCf)}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{pct(lastMonthCf, totalPos)} of total</div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="bu-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Business Unit</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Total Positions</th>
                <th style={{ padding: '10px', textAlign: 'right', color: '#38bdf8' }}>Ad-Hoc</th>
                <th style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>Monthly Approved</th>
                <th style={{ padding: '10px', textAlign: 'right', color: '#eab308' }}>Last Month C/F</th>
              </tr>
            </thead>
            <tbody>
              {businessUnits.map((b) => (
                <tr key={b.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{b.label}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{fmt(b.manpower?.total)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#38bdf8' }}>{fmt(b.manpower?.adHoc)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>
                    {fmt(b.manpower?.monthlyApproved)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#eab308' }}>
                    {fmt(b.manpower?.lastMonthCf)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                style={{
                  fontWeight: 800,
                  background: theme === 'light' ? '#f1f5f9' : '#1e293b',
                  color: theme === 'light' ? '#0f172a' : '#f8fafc',
                  borderTop: '2px solid rgba(56, 189, 248, 0.45)',
                }}
              >
                <td style={{ padding: '10px', background: 'transparent', color: 'inherit' }}>Total</td>
                <td
                  className="n"
                  style={{ padding: '10px', textAlign: 'right', background: 'transparent', color: 'inherit' }}
                >
                  {fmt(totalPos)}
                </td>
                <td
                  className="n"
                  style={{ padding: '10px', textAlign: 'right', background: 'transparent', color: '#38bdf8' }}
                >
                  {fmt(adHoc)}
                </td>
                <td
                  className="n"
                  style={{ padding: '10px', textAlign: 'right', background: 'transparent', color: '#10b981' }}
                >
                  {fmt(monthlyApproved)}
                </td>
                <td
                  className="n"
                  style={{ padding: '10px', textAlign: 'right', background: 'transparent', color: '#eab308' }}
                >
                  {fmt(lastMonthCf)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function PendingPositionsModal({ isOpen, onClose, businessUnits, jobs, unitName, kpi, theme }) {
  const [drillFilter, setDrillFilter] = useState(null);

  useEffect(() => {
    if (!isOpen) setDrillFilter(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const onTrack = businessUnits.reduce((s, b) => s + (b.manpower?.pendingOnTrack || 0), 0);
  const delayed = businessUnits.reduce((s, b) => s + (b.manpower?.pendingDelayed || 0), 0);
  const critical = businessUnits.reduce((s, b) => s + (b.manpower?.pendingCritical || 0), 0);
  const totalHealthPending = onTrack + delayed + critical;

  const drilledJobs = (jobs || []).filter((j) => {
    if (!drillFilter) return false;
    if (norm(j.status) === 'closed' || norm(j.jobHealth) === 'closed') return false;
    if ((j.pending || 0) <= 0) return false;
    if (drillFilter.buLabel !== 'all' && j.businessUnit !== drillFilter.buLabel) return false;
    if (drillFilter.health !== 'all' && j.jobHealth !== drillFilter.health) return false;
    return true;
  });

  const renderClickNum = (val, color, onClick, title) => {
    const n = Number(val || 0);
    if (n <= 0) return <span style={{ opacity: 0.4 }}>0</span>;
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        style={{
          background: `${color}18`,
          color,
          border: `1px solid ${color}66`,
          borderRadius: '6px',
          padding: '2px 9px',
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
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: '14px',
          padding: '22px',
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f8fafc',
          border: '1px solid rgba(234, 179, 8, 0.35)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <p
              className="kicker"
              style={{ margin: 0, color: '#eab308', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}
            >
              Pending Positions by Job Health (Excluding Closed)
            </p>
            <h3 style={{ margin: '4px 0 0', fontSize: '19px' }}>
              {unitName} â€” {fmt(totalHealthPending || kpi?.pending)} Pending Positions
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'inherit',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            âœ•
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'On Track', val: onTrack, color: '#10b981' },
            { label: 'Delayed', val: delayed, color: '#eab308' },
            { label: 'Critical', val: critical, color: '#f87171' },
          ].map((c) => {
            const pctNum = (totalHealthPending || 0) > 0 ? Math.min(100, (c.val / totalHealthPending) * 100) : 0;
            return (
              <div
                key={c.label}
                onClick={() => setDrillFilter({ health: c.label, buLabel: 'all' })}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: `${c.color}14`,
                  border: `1px solid ${c.color}55`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: c.color }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: '11px', color: c.color, fontWeight: 600 }}>View Jobs â†’</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '26px', fontWeight: 800, color: c.color }}>{fmt(c.val)}</span>
                  <span style={{ fontSize: '12px', opacity: 0.85 }}>
                    {pct(c.val, totalHealthPending || 1)} of pending
                  </span>
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    height: '5px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: `${pctNum}%`, height: '100%', background: c.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {!drillFilter ? (
          <div className="table-scroll">
            <table className="bu-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Business Unit</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Pending Positions</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>On Track</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#eab308' }}>Delayed</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#f87171' }}>Critical</th>
                </tr>
              </thead>
              <tbody>
                {businessUnits.map((b) => {
                  const m = b.manpower || {};
                  const buPend =
                    (m.pendingOnTrack || 0) + (m.pendingDelayed || 0) + (m.pendingCritical || 0) || m.pending || 0;
                  return (
                    <tr key={b.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{b.label}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {renderClickNum(
                          buPend,
                          '#38bdf8',
                          () => setDrillFilter({ health: 'all', buLabel: b.label }),
                          `View pending jobs in ${b.label}`
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {renderClickNum(
                          m.pendingOnTrack,
                          '#10b981',
                          () => setDrillFilter({ health: 'On Track', buLabel: b.label }),
                          'View On Track jobs'
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {renderClickNum(
                          m.pendingDelayed,
                          '#eab308',
                          () => setDrillFilter({ health: 'Delayed', buLabel: b.label }),
                          'View Delayed jobs'
                        )}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {renderClickNum(
                          m.pendingCritical,
                          '#f87171',
                          () => setDrillFilter({ health: 'Critical', buLabel: b.label }),
                          'View Critical jobs'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    fontWeight: 800,
                    background: theme === 'light' ? '#f1f5f9' : '#1e293b',
                    color: theme === 'light' ? '#0f172a' : '#f8fafc',
                    borderTop: '2px solid rgba(234, 179, 8, 0.45)',
                  }}
                >
                  <td style={{ padding: '10px', background: 'transparent', color: 'inherit' }}>Total</td>
                  <td className="n" style={{ padding: '10px', textAlign: 'right', background: 'transparent' }}>
                    {renderClickNum(
                      totalHealthPending || kpi?.pending,
                      '#38bdf8',
                      () => setDrillFilter({ health: 'all', buLabel: 'all' }),
                      'View all pending jobs'
                    )}
                  </td>
                  <td className="n" style={{ padding: '10px', textAlign: 'right', background: 'transparent' }}>
                    {renderClickNum(
                      onTrack,
                      '#10b981',
                      () => setDrillFilter({ health: 'On Track', buLabel: 'all' }),
                      'View all On Track pending jobs'
                    )}
                  </td>
                  <td className="n" style={{ padding: '10px', textAlign: 'right', background: 'transparent' }}>
                    {renderClickNum(
                      delayed,
                      '#eab308',
                      () => setDrillFilter({ health: 'Delayed', buLabel: 'all' }),
                      'View all Delayed pending jobs'
                    )}
                  </td>
                  <td className="n" style={{ padding: '10px', textAlign: 'right', background: 'transparent' }}>
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
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ fontSize: '14px' }}>
                Showing {drilledJobs.length} Job(s) Â· {drillFilter.buLabel === 'all' ? 'All BUs' : drillFilter.buLabel} Â·{' '}
                {drillFilter.health === 'all' ? 'All Health Statuses' : drillFilter.health}
              </strong>
              <button
                type="button"
                onClick={() => setDrillFilter(null)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(56,189,248,0.4)',
                  background: 'transparent',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                â† Back to BU Summary
              </button>
            </div>
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Job ID</th>
                    <th style={{ padding: '8px' }}>Role / Job Name</th>
                    <th style={{ padding: '8px' }}>Business Unit</th>
                    <th style={{ padding: '8px' }}>Department</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Pending</th>
                    <th style={{ padding: '8px' }}>Target Date</th>
                    <th style={{ padding: '8px' }}>Days to Target</th>
                    <th style={{ padding: '8px' }}>Job Health</th>
                  </tr>
                </thead>
                <tbody>
                  {drilledJobs.map((j, i) => {
                    const hs = getJobHealthBadgeStyle(j.jobHealth);
                    return (
                      <tr key={`${j.jobId}-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{j.jobId}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{j.role || 'â€”'}</td>
                        <td style={{ padding: '8px' }}>{j.businessUnit}</td>
                        <td style={{ padding: '8px' }}>{j.department || 'â€”'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#eab308' }}>
                          {fmt(j.pending)}
                        </td>
                        <td style={{ padding: '8px' }}>{j.targetDate || 'â€”'}</td>
                        <td style={{ padding: '8px' }}>{j.daysToTarget || 'â€”'}</td>
                        <td style={{ padding: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: hs.color,
                              background: hs.bg,
                              border: `1px solid ${hs.border}`,
                            }}
                          >
                            {j.jobHealth || 'â€”'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CvLess5Modal({ isOpen, onClose, jobs, unitName, theme }) {
  if (!isOpen) return null;
  const cvJobs = (jobs || []).filter((j) => j.cvLess5);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: '14px',
          padding: '22px',
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f8fafc',
          border: '1px solid rgba(244, 114, 182, 0.4)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <p
              className="kicker"
              style={{ margin: 0, color: '#f472b6', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}
            >
              Low Pipeline Alert (CV &lt; 5 Checker)
            </p>
            <h3 style={{ margin: '4px 0 0', fontSize: '19px' }}>
              {unitName} â€” {fmt(cvJobs.length)} Role(s) Flagged with CV &lt; 5
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'inherit',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            âœ•
          </button>
        </div>

        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Job ID</th>
                <th style={{ padding: '8px' }}>Role / Job Name</th>
                <th style={{ padding: '8px' }}>Business Unit</th>
                <th style={{ padding: '8px' }}>Department</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Top of Funnel</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>TA Shortlisted</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Pending Pos.</th>
                <th style={{ padding: '8px' }}>Job Health</th>
              </tr>
            </thead>
            <tbody>
              {cvJobs.map((j, i) => (
                <tr key={`${j.jobId}-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{j.jobId}</td>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{j.role || 'â€”'}</td>
                  <td style={{ padding: '8px' }}>{j.businessUnit}</td>
                  <td style={{ padding: '8px' }}>{j.department || 'â€”'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(j.topOfFunnel)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(j.taShortlisted)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#eab308' }}>
                    {fmt(j.pending)}
                  </td>
                  <td style={{ padding: '8px', fontWeight: 700 }}>{j.jobHealth || 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function JobCandidatesModal({ job, onClose, theme }) {
  if (!job) return null;
  const candidates = job.candidates || [];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '940px',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: '14px',
          padding: '22px',
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          color: theme === 'light' ? '#0f172a' : '#f8fafc',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <p
              className="kicker"
              style={{ margin: 0, color: '#38bdf8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}
            >
              {job.businessUnit} Â· {job.department || 'Department'}
            </p>
            <h3 style={{ margin: '4px 0 0', fontSize: '19px' }}>
              {job.jobId} â€” {job.role || 'Role'} ({candidates.length} Candidates)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'inherit',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            âœ•
          </button>
        </div>

        {candidates.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>No candidate records mapped to this Job ID yet.</p>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Candidate Name</th>
                  <th style={{ padding: '8px' }}>Email / Phone</th>
                  <th style={{ padding: '8px' }}>Recruiter</th>
                  <th style={{ padding: '8px' }}>Pre-Offer Status</th>
                  <th style={{ padding: '8px' }}>Candidate Status</th>
                  <th style={{ padding: '8px' }}>Final Status</th>
                  <th style={{ padding: '8px' }}>Offer / Joining Date</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, idx) => (
                  <tr key={`${c.email}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{c.name || 'â€”'}</td>
                    <td style={{ padding: '8px' }}>
                      <div>{c.email || 'â€”'}</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>{c.phone || ''}</div>
                    </td>
                    <td style={{ padding: '8px' }}>{c.recruiter || 'â€”'}</td>
                    <td style={{ padding: '8px' }}>{c.preOfferStatus || 'â€”'}</td>
                    <td style={{ padding: '8px' }}>{c.status || 'â€”'}</td>
                    <td style={{ padding: '8px', fontWeight: 700, color: '#10b981' }}>{c.finalStatus || 'â€”'}</td>
                    <td style={{ padding: '8px', fontSize: '11.5px' }}>
                      {c.offerDate ? `Off: ${c.offerDate}` : ''}{' '}
                      {c.joiningDate ? `| Join: ${c.joiningDate}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Month-on-Month Offered vs. Joined Section ---------- */

function MomOfferedJoinedSection({ momSeries, selectedBu, theme }) {
  const [drillMonth, setDrillMonth] = useState(null);

  const filteredSeries = useMemo(() => {
    return (momSeries || []).map((m) => {
      if (selectedBu === 'all') {
        return {
          month: m.month,
          label: formatYearMonth(m.month),
          offered: m.offered || 0,
          joined: m.joined || 0,
          offeredCandidates: m.offeredCandidates || [],
          joinedCandidates: m.joinedCandidates || [],
        };
      }
      const buStat = (m.byBu && m.byBu[selectedBu]) || { offered: 0, joined: 0 };
      return {
        month: m.month,
        label: formatYearMonth(m.month),
        offered: buStat.offered || 0,
        joined: buStat.joined || 0,
        offeredCandidates: (m.offeredCandidates || []).filter((c) => c.businessUnit === selectedBu),
        joinedCandidates: (m.joinedCandidates || []).filter((c) => c.businessUnit === selectedBu),
      };
    });
  }, [momSeries, selectedBu]);

  const totalOffered = filteredSeries.reduce((s, m) => s + m.offered, 0);
  const totalJoined = filteredSeries.reduce((s, m) => s + m.joined, 0);
  const maxVal = Math.max(10, ...filteredSeries.map((m) => Math.max(m.offered, m.joined)));

  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const subCardBg = theme === 'light' ? '#f8fafc' : 'rgba(15, 23, 42, 0.55)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
  const mutedColor = theme === 'light' ? '#64748b' : '#94a3b8';

  if (filteredSeries.length === 0) return null;

  return (
    <section
      className="panel"
      style={{
        marginTop: '28px',
        padding: '22px',
        borderRadius: '14px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '18px',
        }}
      >
        <div>
          <p className="kicker" style={{ margin: '0 0 3px' }}>
            Historical Hiring Velocity (Click any bar to inspect candidates)
          </p>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Month-on-Month Offered vs. Joined</h2>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px', fontWeight: 700 }}>
          <span style={{ color: '#38bdf8' }}>Total Offered: {fmt(totalOffered)}</span>
          <span style={{ color: '#10b981' }}>Total Joined: {fmt(totalJoined)}</span>
          <span style={{ color: '#eab308' }}>Joining Ratio: {pct(totalJoined, totalOffered)}</span>
        </div>
      </div>

      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          background: subCardBg,
          border: `1px solid ${borderColor}`,
          overflowX: 'auto',
        }}
      >
        <svg
          viewBox={`0 0 ${Math.max(680, filteredSeries.length * 78)} 220`}
          style={{ width: '100%', minWidth: '640px', height: '220px', display: 'block' }}
        >
          {filteredSeries.map((d, idx) => {
            const svgW = Math.max(680, filteredSeries.length * 78);
            const colW = (svgW - 40) / Math.max(1, filteredSeries.length);
            const cx = 20 + idx * colW + colW / 2;
            const plotH = 155;
            const topPad = 26;
            const offH = (d.offered / maxVal) * plotH;
            const joinH = (d.joined / maxVal) * plotH;
            const barW = Math.min(22, colW * 0.34);

            return (
              <g key={d.month}>
                <rect
                  x={cx - barW - 2}
                  y={topPad + plotH - offH}
                  width={barW}
                  height={Math.max(2, offH)}
                  rx="4"
                  fill="#38bdf8"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setDrillMonth({ month: d.label, type: 'Offered', candidates: d.offeredCandidates })
                  }
                />
                {d.offered > 0 && (
                  <text
                    x={cx - barW / 2 - 2}
                    y={Math.max(12, topPad + plotH - offH - 5)}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {d.offered}
                  </text>
                )}

                <rect
                  x={cx + 2}
                  y={topPad + plotH - joinH}
                  width={barW}
                  height={Math.max(2, joinH)}
                  rx="4"
                  fill="#10b981"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setDrillMonth({ month: d.label, type: 'Joined', candidates: d.joinedCandidates })
                  }
                />
                {d.joined > 0 && (
                  <text
                    x={cx + barW / 2 + 2}
                    y={Math.max(12, topPad + plotH - joinH - 5)}
                    textAnchor="middle"
                    fill="#10b981"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {d.joined}
                  </text>
                )}

                <text
                  x={cx}
                  y={204}
                  textAnchor="middle"
                  fill={mutedColor}
                  fontSize="11"
                  fontWeight="600"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {drillMonth && (
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            borderRadius: '12px',
            background: subCardBg,
            border: `1px solid ${borderColor}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong>
              {drillMonth.month} â€” {drillMonth.type} Candidates ({drillMonth.candidates.length})
            </strong>
            <button
              type="button"
              onClick={() => setDrillMonth(null)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: `1px solid ${borderColor}`,
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              Close âœ•
            </button>
          </div>
          <div className="table-scroll" style={{ maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>Candidate</th>
                  <th style={{ padding: '6px' }}>Role</th>
                  <th style={{ padding: '6px' }}>Business Unit</th>
                  <th style={{ padding: '6px' }}>Recruiter</th>
                  <th style={{ padding: '6px' }}>Channel / Source</th>
                  <th style={{ padding: '6px' }}>Offer Date</th>
                  <th style={{ padding: '6px' }}>Joining Date</th>
                </tr>
              </thead>
              <tbody>
                {drillMonth.candidates.map((c, i) => (
                  <tr key={`${c.name}-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '6px', fontWeight: 700 }}>{c.name}</td>
                    <td style={{ padding: '6px' }}>{c.role}</td>
                    <td style={{ padding: '6px' }}>{c.businessUnit}</td>
                    <td style={{ padding: '6px' }}>{c.recruiter}</td>
                    <td style={{ padding: '6px' }}>
                      {c.channel} ({c.source})
                    </td>
                    <td style={{ padding: '6px' }}>{c.offerDate}</td>
                    <td style={{ padding: '6px' }}>{c.joiningDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Channel Analysis & Efficiency Section ---------- */

function ChannelAnalyticsSection({ unitData, selectedBu, theme }) {
  const [effMonth, setEffMonth] = useState('overall');

  const overallBreakdown = useMemo(() => {
    if (!unitData) return {};
    if (selectedBu === 'all') return unitData.channelBreakdown || {};
    return (unitData.channelBreakdownByBu && unitData.channelBreakdownByBu[selectedBu]) || {};
  }, [unitData, selectedBu]);

  const currentMonthBreakdown = useMemo(() => {
    if (!unitData) return {};
    if (selectedBu === 'all') return unitData.currentChannelBreakdown || {};
    return (unitData.currentChannelBreakdownByBu && unitData.currentChannelBreakdownByBu[selectedBu]) || {};
  }, [unitData, selectedBu]);

  const availableEffMonths = useMemo(() => {
    if (!unitData) return [];
    const mMap =
      selectedBu === 'all'
        ? unitData.channelEfficiencyMonthly || {}
        : (unitData.channelEfficiencyMonthlyByBu && unitData.channelEfficiencyMonthlyByBu[selectedBu]) || {};
    return Object.keys(mMap).sort();
  }, [unitData, selectedBu]);

  const activeEffMap = useMemo(() => {
    if (!unitData) return {};
    if (effMonth === 'overall') {
      if (selectedBu === 'all') return unitData.channelEfficiencyOverall || {};
      return (unitData.channelEfficiencyOverallByBu && unitData.channelEfficiencyOverallByBu[selectedBu]) || {};
    }
    const mMap =
      selectedBu === 'all'
        ? unitData.channelEfficiencyMonthly || {}
        : (unitData.channelEfficiencyMonthlyByBu && unitData.channelEfficiencyMonthlyByBu[selectedBu]) || {};
    return mMap[effMonth] || {};
  }, [unitData, selectedBu, effMonth]);

  const channelMomList = useMemo(() => {
    if (!unitData) return [];
    if (selectedBu === 'all') return unitData.channelMomSeries || [];
    return (unitData.channelMomByBu && unitData.channelMomByBu[selectedBu]) || [];
  }, [unitData, selectedBu]);

  const totalOverallJoined = Object.values(overallBreakdown).reduce((s, v) => s + Number(v || 0), 0);
  const totalCurrentJoined = Object.values(currentMonthBreakdown).reduce((s, v) => s + Number(v || 0), 0);

  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const subCardBg = theme === 'light' ? '#f8fafc' : 'rgba(15, 23, 42, 0.55)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';

  return (
    <section
      className="panel"
      style={{
        marginTop: '28px',
        padding: '22px',
        borderRadius: '14px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div>
          <p className="kicker" style={{ margin: '0 0 3px' }}>
            Sourcing Mix &amp; Conversion Efficiency
          </p>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Channel Breakdown &amp; Channel Efficiency</h2>
        </div>

        <select
          value={effMonth}
          onChange={(e) => setEffMonth(e.target.value)}
          style={{
            height: '36px',
            padding: '0 12px',
            borderRadius: '8px',
            background: subCardBg,
            color: 'inherit',
            border: `1px solid ${borderColor}`,
            fontWeight: 600,
            fontSize: '12.5px',
          }}
        >
          <option value="overall" style={{ background: '#0f172a', color: '#fff' }}>
            Efficiency Scope: Overall
          </option>
          {availableEffMonths.map((ym) => (
            <option key={ym} value={ym} style={{ background: '#0f172a', color: '#fff' }}>
              Efficiency Month: {formatYearMonth(ym)}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ padding: '16px', borderRadius: '12px', background: subCardBg, border: `1px solid ${borderColor}` }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>
            Overall Joinings by Channel ({fmt(totalOverallJoined)})
          </h3>
          {CHANNEL_ORDER.map((ch) => {
            const count = Number(overallBreakdown[ch] || 0);
            const share = totalOverallJoined > 0 ? (count / totalOverallJoined) * 100 : 0;
            const color = CHANNEL_COLORS[ch] || '#38bdf8';
            return (
              <div key={ch} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{ch}</span>
                  <span>
                    <strong>{fmt(count)}</strong> ({share.toFixed(1)}%)
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '16px', borderRadius: '12px', background: subCardBg, border: `1px solid ${borderColor}` }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>
            Current Month Joinings by Channel ({fmt(totalCurrentJoined)})
          </h3>
          {CHANNEL_ORDER.map((ch) => {
            const count = Number(currentMonthBreakdown[ch] || 0);
            const share = totalCurrentJoined > 0 ? (count / totalCurrentJoined) * 100 : 0;
            const color = CHANNEL_COLORS[ch] || '#10b981';
            return (
              <div key={ch} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{ch}</span>
                  <span>
                    <strong>{fmt(count)}</strong> ({share.toFixed(1)}%)
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '16px', borderRadius: '12px', background: subCardBg, border: `1px solid ${borderColor}` }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>
            Channel Conversion Efficiency ({effMonth === 'overall' ? 'Overall' : formatYearMonth(effMonth)})
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'left' }}>
                <th style={{ padding: '6px' }}>Channel</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Applied</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Joined</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Conv %</th>
              </tr>
            </thead>
            <tbody>
              {CHANNEL_ORDER.map((ch) => {
                const st = activeEffMap[ch] || { applied: 0, joined: 0 };
                return (
                  <tr key={ch} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '6px', fontWeight: 600 }}>{ch}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{fmt(st.applied)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                      {fmt(st.joined)}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>
                      {pct(st.joined, st.applied)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {channelMomList.length > 0 && (
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: subCardBg,
            border: `1px solid ${borderColor}`,
            overflowX: 'auto',
          }}
        >
          <h3 style={{ margin: '0 0 10px', fontSize: '14.5px' }}>
            Month-on-Month Channel Mix (Internal/Referral vs. External Share %)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Month</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#10b981' }}>Internal / Campus / Referral</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#a78bfa' }}>Business Reference</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#f87171' }}>External Agency</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Total Joined</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#eab308' }}>External Share %</th>
              </tr>
            </thead>
            <tbody>
              {channelMomList.map((row) => (
                <tr key={row.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px', fontWeight: 700 }}>{formatYearMonth(row.month)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                    {fmt(row.internalGroup)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#a78bfa' }}>
                    {fmt(row.businessReference)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#f87171', fontWeight: 600 }}>
                    {fmt(row.external)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{fmt(row.totalJoined)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#eab308' }}>
                    {row.externalPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Sleek Modern Stage-Wise Recruitment Funnel & Joining Bifurcation Section ---------- */

function RecruitmentFunnelAndBifurcationSection({
  funnelAnalytics,
  selectedBu,
  theme,
}) {
  const [selectedRecruiter, setSelectedRecruiter] = useState('all');
  const [periodMode, setPeriodMode] = useState('fy26_27');
  const [activeTab, setActiveTab] = useState('both');

  const recruitersList = useMemo(() => {
    const raw = funnelAnalytics?.recruiters || [];
    return Array.from(new Set(raw.filter((r) => r && norm(r) !== 'unassigned'))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [funnelAnalytics]);

  useEffect(() => {
    if (selectedRecruiter !== 'all' && !recruitersList.includes(selectedRecruiter)) {
      setSelectedRecruiter('all');
    }
  }, [recruitersList, selectedRecruiter]);

  const activeMonthlyMap = useMemo(() => {
    if (!funnelAnalytics) return {};
    if (selectedBu === 'all') {
      if (selectedRecruiter === 'all') {
        return funnelAnalytics.byMonth || {};
      }
      return (funnelAnalytics.byRecruiter && funnelAnalytics.byRecruiter[selectedRecruiter]) || {};
    } else {
      if (selectedRecruiter === 'all') {
        return (funnelAnalytics.byBu && funnelAnalytics.byBu[selectedBu]) || {};
      }
      return (
        (funnelAnalytics.byBuAndRecruiter &&
          funnelAnalytics.byBuAndRecruiter[selectedBu] &&
          funnelAnalytics.byBuAndRecruiter[selectedBu][selectedRecruiter]) ||
        {}
      );
    }
  }, [funnelAnalytics, selectedBu, selectedRecruiter]);

  const displayedMonths = useMemo(() => {
    if (periodMode === 'fy26_27') {
      return generateMonthSequence('2026-04', '2027-03');
    }
    if (periodMode === 'fy25_26') {
      return generateMonthSequence('2025-06', '2026-03');
    }
    return generateMonthSequence('2025-06', '2027-03');
  }, [periodMode]);

  const ytdColumnLabel = useMemo(() => {
    if (periodMode === 'fy26_27') return 'YTD (26â€“27)';
    if (periodMode === 'fy25_26') return 'YTD (25â€“26)';
    return 'Total';
  }, [periodMode]);

  const getCellVal = useCallback(
    (ym, metricKey) => {
      const mObj = activeMonthlyMap[ym];
      return mObj ? Number(mObj[metricKey] || 0) : 0;
    },
    [activeMonthlyMap]
  );

  const getRowYtd = useCallback(
    (metricKey) => {
      return displayedMonths.reduce((sum, ym) => sum + getCellVal(ym, metricKey), 0);
    },
    [displayedMonths, getCellVal]
  );

  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const subCardBg = theme === 'light' ? '#f8fafc' : 'rgba(15, 23, 42, 0.55)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
  const rowBorder = theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.055)';
  const textColor = theme === 'light' ? '#0f172a' : '#f1f5f9';
  const mutedColor = theme === 'light' ? '#64748b' : '#64748b';
  const stickyBg = theme === 'light' ? '#f8fafc' : '#0d1526';
  const headerBg = theme === 'light' ? '#f1f5f9' : 'rgba(30, 41, 59, 0.75)';

  const renderModernTable = (groups, title, subtitle) => (
    <div
      style={{
        borderRadius: '12px',
        background: subCardBg,
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          background: theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle && (
            <span style={{ fontSize: '12px', color: mutedColor, fontWeight: 500 }}>Â· {subtitle}</span>
          )}
        </div>
      </div>

      <div className="table-scroll" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
        <table className="sleek-funnel-table" style={{ minWidth: `${260 + displayedMonths.length * 74}px` }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  paddingLeft: '18px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  background: theme === 'light' ? '#f1f5f9' : '#162033',
                  minWidth: '215px',
                }}
              >
                Stage / Metric
              </th>
              {displayedMonths.map((ym) => (
                <th key={ym} style={{ textAlign: 'right' }}>
                  {formatYearMonth(ym)}
                </th>
              ))}
              <th style={{ textAlign: 'right', paddingRight: '18px', minWidth: '105px', color: '#38bdf8' }}>
                {ytdColumnLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const accent = STAGE_ACCENTS[group.stage] || STAGE_ACCENTS['TA Round'];
              return (
                <Fragment key={group.stage}>
                  <tr className="stage-band-row">
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        background: stickyBg,
                        padding: '10px 14px 6px 18px',
                        borderBottom: 'none',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: accent.color,
                          background: accent.bg,
                          border: `1px solid ${accent.border}`,
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: accent.color,
                            display: 'inline-block',
                          }}
                        />
                        {group.headerBanner ? `${group.headerBanner} Â· ${group.stage}` : group.stage}
                      </span>
                    </td>
                    <td
                      colSpan={displayedMonths.length + 1}
                      style={{ background: stickyBg, borderBottom: 'none', padding: 0 }}
                    />
                  </tr>

                  {group.rows.map((row, rIdx) => {
                    const ytdVal = getRowYtd(row.key);
                    const isPrimaryRow = rIdx === 0 && group.rows.length > 1;
                    return (
                      <tr key={row.key} className="sleek-metric-row">
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            background: stickyBg,
                            paddingLeft: '28px',
                            fontWeight: isPrimaryRow ? 600 : 500,
                            color: isPrimaryRow ? textColor : theme === 'light' ? '#334155' : '#cbd5e1',
                            boxShadow: `inset 3px 0 0 ${accent.color}`,
                          }}
                        >
                          {row.label}
                        </td>
                        {displayedMonths.map((ym) => {
                          const v = getCellVal(ym, row.key);
                          return (
                            <td
                              key={ym}
                              style={{
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                color: v === 0 ? mutedColor : textColor,
                                opacity: v === 0 ? 0.38 : 1,
                                fontWeight: v > 0 ? (isPrimaryRow ? 600 : 500) : 400,
                              }}
                            >
                              {v === 0 ? 'â€”' : fmt(v)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right', paddingRight: '18px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              minWidth: '48px',
                              textAlign: 'right',
                              padding: '2px 9px',
                              borderRadius: '6px',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              background: ytdVal > 0 ? accent.bg : 'transparent',
                              color: ytdVal > 0 ? accent.color : mutedColor,
                              opacity: ytdVal === 0 ? 0.4 : 1,
                            }}
                          >
                            {ytdVal === 0 ? 'â€”' : fmt(ytdVal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {group.showNonInternalPctRow && (
                    <tr className="sleek-pct-row">
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: theme === 'light' ? '#fffbeb' : '#181926',
                          paddingLeft: '28px',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          color: '#eab308',
                          boxShadow: 'inset 3px 0 0 #eab308',
                        }}
                      >
                        Ref. &amp; External Share %
                      </td>
                      {displayedMonths.map((ym) => {
                        const empRef = getCellVal(ym, 'chEmpReferral');
                        const busRef = getCellVal(ym, 'chBusReference');
                        const ext = getCellVal(ym, 'chExternal');
                        const totJoin =
                          getCellVal(ym, 'chInternal') +
                          getCellVal(ym, 'chCampus') +
                          empRef +
                          busRef +
                          ext;
                        const pctVal =
                          totJoin > 0 ? `${(((empRef + busRef + ext) / totJoin) * 100).toFixed(1)}%` : 'â€”';
                        return (
                          <td
                            key={ym}
                            style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: totJoin > 0 ? '#eab308' : mutedColor,
                              opacity: totJoin > 0 ? 1 : 0.35,
                              background:
                                theme === 'light' ? 'rgba(254, 243, 199, 0.45)' : 'rgba(234, 179, 8, 0.06)',
                            }}
                          >
                            {pctVal}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          textAlign: 'right',
                          paddingRight: '18px',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#eab308',
                          background:
                            theme === 'light' ? 'rgba(254, 243, 199, 0.45)' : 'rgba(234, 179, 8, 0.06)',
                        }}
                      >
                        {(() => {
                          const empRef = getRowYtd('chEmpReferral');
                          const busRef = getRowYtd('chBusReference');
                          const ext = getRowYtd('chExternal');
                          const totJoin =
                            getRowYtd('chInternal') +
                            getRowYtd('chCampus') +
                            empRef +
                            busRef +
                            ext;
                          return totJoin > 0 ? `${(((empRef + busRef + ext) / totJoin) * 100).toFixed(1)}%` : 'â€”';
                        })()}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section
      className="panel"
      style={{
        marginTop: '28px',
        padding: '22px',
        borderRadius: '14px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
        color: textColor,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style jsx>{`
        .sleek-funnel-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          letter-spacing: -0.01em;
        }
        .sleek-funnel-table thead th {
          background: ${headerBg};
          color: ${theme === 'light' ? '#475569' : '#94a3b8'};
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 11px 12px;
          border-bottom: 1px solid ${borderColor};
          white-space: nowrap;
        }
        .sleek-funnel-table tbody td {
          padding: 8px 12px;
          border-bottom: ${rowBorder};
          white-space: nowrap;
          transition: background 0.12s ease;
        }
        .sleek-metric-row:hover td {
          background: ${theme === 'light' ? '#f1f5f9' : 'rgba(56, 189, 248, 0.06)'} !important;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <p className="kicker" style={{ marginBottom: '3px' }}>End-to-End Conversion &amp; Joining Split</p>
          <h2 style={{ margin: 0, fontSize: '21px', letterSpacing: '-0.02em' }}>
            Stage-Wise Recruitment Funnel &amp; Joining Bifurcation
          </h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '12.5px' }}>
            {selectedBu === 'all' ? 'All Business Units' : selectedBu} Â·{' '}
            {selectedRecruiter === 'all' ? 'All Recruiters' : `Recruiter: ${selectedRecruiter}`} Â· Data from June 2025
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '8px',
              background: theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${borderColor}`,
            }}
          >
            {[
              { id: 'both', label: 'Both' },
              { id: 'funnel', label: 'Funnel' },
              { id: 'bifurcation', label: 'Bifurcation' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === t.id ? '#059669' : 'transparent',
                  color: activeTab === t.id ? '#ffffff' : 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <select
            value={selectedRecruiter}
            onChange={(e) => setSelectedRecruiter(e.target.value)}
            aria-label="Filter Funnel by Recruiter"
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            <option value="all" style={{ background: '#0f172a', color: '#fff' }}>
              Recruiter: All Recruiters
            </option>
            {recruitersList.map((rName) => (
              <option key={rName} value={rName} style={{ background: '#0f172a', color: '#fff' }}>
                Recruiter: {rName}
              </option>
            ))}
          </select>

          <select
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value)}
            aria-label="Select Funnel Timeline"
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              border: '1px solid rgba(234, 179, 8, 0.55)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            <option value="fy26_27" style={{ background: '#0f172a', color: '#fff' }}>
              FY 2026â€“27 (Apr â€™26 â€“ Mar â€™27)
            </option>
            <option value="fy25_26" style={{ background: '#0f172a', color: '#fff' }}>
              FY 2025â€“26 (Jun â€™25 â€“ Mar â€™26)
            </option>
            <option value="all_from_jun25" style={{ background: '#0f172a', color: '#fff' }}>
              All Months (Jun â€™25 â€“ Mar â€™27)
            </option>
          </select>
        </div>
      </div>

      {(activeTab === 'both' || activeTab === 'funnel') &&
        renderModernTable(
          FUNNEL_STAGE_GROUPS,
          'Stage-Wise Recruitment Funnel',
          'TA Round, Interviews (R1â€“R3), Offers & Joinings'
        )}

      {(activeTab === 'both' || activeTab === 'bifurcation') &&
        renderModernTable(
          BIFURCATION_GROUPS,
          'Joining Bifurcation',
          'Channel, Internal Source, Employment Type & Category'
        )}
    </section>
  );
}

/* ---------- Cost Analysis: MoM Team ROI & Cost Per Hire (CPH) Section ---------- */

function CostAndRoiAnalyticsSection({
  costAnalytics,
  costAnalyticsOverall,
  unitKey,
  selectedBu,
  theme,
}) {
  const [periodMode, setPeriodMode] = useState('fy26_27');
  const [cphMode, setCphMode] = useState('blended');
  const [showToolsModal, setShowToolsModal] = useState(false);

  const activeCostStore = useMemo(() => {
    if (unitKey === 'overall' && selectedBu === 'all') {
      return costAnalyticsOverall || costAnalytics || {};
    }
    return costAnalytics || costAnalyticsOverall || {};
  }, [unitKey, selectedBu, costAnalytics, costAnalyticsOverall]);

  const activeMonthlyMap = useMemo(() => {
    if (!activeCostStore) return {};
    if (selectedBu === 'all') {
      return activeCostStore.byMonth || {};
    }
    return (activeCostStore.byBu && activeCostStore.byBu[selectedBu]) || {};
  }, [activeCostStore, selectedBu]);

  const displayedMonths = useMemo(() => {
    if (periodMode === 'fy26_27') {
      return generateMonthSequence('2026-04', '2027-03');
    }
    if (periodMode === 'fy25_26') {
      return generateMonthSequence('2025-06', '2026-03');
    }
    return generateMonthSequence('2025-06', '2027-03');
  }, [periodMode]);

  const ytdLabel = useMemo(() => {
    if (periodMode === 'fy26_27') return 'FY 26â€“27 YTD';
    if (periodMode === 'fy25_26') return 'FY 25â€“26 Total';
    return 'Overall Total';
  }, [periodMode]);

  const monthSeries = useMemo(() => {
    return displayedMonths.map((ym) => {
      const m = activeMonthlyMap[ym] || {};
      const joined = Number(m.joined || 0);
      const joinedFulltime = Number(m.joinedFulltime || 0);
      const joinedIntern = Number(m.joinedIntern || 0);
      const internalJoined = Number(m.internalJoined || 0);
      const empReferralJoined = Number(m.empReferralJoined || 0);
      const busReferenceJoined = Number(m.busReferenceJoined || 0);
      const externalJoined = Number(m.externalJoined || 0);

      const teamPayrollCost = joined > 0 ? Number(m.teamPayrollCost || 0) : 0;
      const toolsCost = joined > 0 ? Number(m.toolsCost || 0) : 0;
      const empReferralCost = Number(m.empReferralCost || 0);
      const externalAgencyCost = Number(m.externalAgencyCost || 0);
      const variableCost = Number(m.variableCost || empReferralCost + externalAgencyCost);

      const totalBlendedCost = teamPayrollCost + toolsCost + variableCost;
      const directCostExclPayroll = toolsCost + variableCost;
      const activeTotalCost = cphMode === 'blended' ? totalBlendedCost : directCostExclPayroll;
      const activeCph = joined > 0 ? Math.round(activeTotalCost / joined) : 0;

      const weightedMonthlyRoiVal = Number(m.weightedMonthlyRoiVal || 0);
      const teamRoi =
        teamPayrollCost > 0
          ? Math.round((weightedMonthlyRoiVal / teamPayrollCost) * 10) / 10
          : 0;

      const agencyCostSaved = Number(m.agencyCostSaved || 0);
      const totalAnnualCtcHired = Number(m.totalAnnualCtcHired || 0);

      return {
        month: ym,
        label: formatYearMonth(ym),
        joined,
        joinedFulltime,
        joinedIntern,
        internalJoined,
        empReferralJoined,
        busReferenceJoined,
        externalJoined,
        teamPayrollCost,
        toolsCost,
        empReferralCost,
        externalAgencyCost,
        variableCost,
        totalBlendedCost,
        directCostExclPayroll,
        activeTotalCost,
        activeCph,
        weightedMonthlyRoiVal,
        teamRoi,
        agencyCostSaved,
        totalAnnualCtcHired,
      };
    });
  }, [displayedMonths, activeMonthlyMap, cphMode]);

  const summary = useMemo(() => {
    let totalJoined = 0;
    let totalFulltime = 0;
    let totalIntern = 0;
    let internalJoined = 0;
    let empReferralJoined = 0;
    let busReferenceJoined = 0;
    let externalJoined = 0;

    let sumPayroll = 0;
    let sumTools = 0;
    let sumEmpRefCost = 0;
    let sumExtAgencyCost = 0;
    let sumActiveCost = 0;
    let sumWeightedRoiVal = 0;
    let sumAgencySaved = 0;
    let sumAnnualCtc = 0;

    let activeRoiMonths = 0;
    let sumMonthlyRois = 0;

    monthSeries.forEach((m) => {
      if (m.joined > 0) {
        totalJoined += m.joined;
        totalFulltime += m.joinedFulltime;
        totalIntern += m.joinedIntern;
        internalJoined += m.internalJoined;
        empReferralJoined += m.empReferralJoined;
        busReferenceJoined += m.busReferenceJoined;
        externalJoined += m.externalJoined;

        sumPayroll += m.teamPayrollCost;
        sumTools += m.toolsCost;
        sumEmpRefCost += m.empReferralCost;
        sumExtAgencyCost += m.externalAgencyCost;
        sumActiveCost += m.activeTotalCost;
        sumWeightedRoiVal += m.weightedMonthlyRoiVal;
        sumAgencySaved += m.agencyCostSaved;
        sumAnnualCtc += m.totalAnnualCtcHired;

        if (m.teamRoi > 0) {
          activeRoiMonths++;
          sumMonthlyRois += m.teamRoi;
        }
      }
    });

    const avgTeamRoi =
      sumPayroll > 0
        ? Math.round((sumWeightedRoiVal / sumPayroll) * 10) / 10
        : activeRoiMonths > 0
        ? Math.round((sumMonthlyRois / activeRoiMonths) * 10) / 10
        : 0;

    const ytdCph = totalJoined > 0 ? Math.round(sumActiveCost / totalJoined) : 0;

    const internalSourcedPool = internalJoined + busReferenceJoined;
    const internalFixedPoolCost = cphMode === 'blended' ? sumPayroll + sumTools : sumTools;
    const internalCph =
      internalSourcedPool > 0 ? Math.round(internalFixedPoolCost / internalSourcedPool) : 0;
    const referralCph =
      empReferralJoined > 0 ? Math.round(sumEmpRefCost / empReferralJoined) : 0;
    const externalCph =
      externalJoined > 0 ? Math.round(sumExtAgencyCost / externalJoined) : 0;

    return {
      totalJoined,
      totalFulltime,
      totalIntern,
      internalJoined,
      empReferralJoined,
      busReferenceJoined,
      externalJoined,
      sumPayroll,
      sumTools,
      sumEmpRefCost,
      sumExtAgencyCost,
      sumActiveCost,
      sumWeightedRoiVal,
      sumAgencySaved,
      sumAnnualCtc,
      avgTeamRoi,
      ytdCph,
      internalCph,
      referralCph,
      externalCph,
    };
  }, [monthSeries, cphMode]);

  const toolsList = activeCostStore?.tools || costAnalyticsOverall?.tools || [];
  const roiTarget = Number(activeCostStore?.roiTarget || 15);

  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const subCardBg = theme === 'light' ? '#f8fafc' : 'rgba(15, 23, 42, 0.55)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
  const rowBorder = theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.055)';
  const textColor = theme === 'light' ? '#0f172a' : '#f1f5f9';
  const mutedColor = theme === 'light' ? '#64748b' : '#94a3b8';
  const stickyBg = theme === 'light' ? '#f8fafc' : '#0d1526';
  const headerBg = theme === 'light' ? '#f1f5f9' : 'rgba(30, 41, 59, 0.75)';

  const activeChartMonths = monthSeries.filter((m) => m.joined > 0 || m.activeTotalCost > 0);
  const chartData = activeChartMonths.length > 0 ? activeChartMonths : monthSeries.slice(0, 8);
  const maxRoi = Math.max(roiTarget * 1.35, ...chartData.map((d) => d.teamRoi || 0), 20);
  const maxCph = Math.max(...chartData.map((d) => d.activeCph || 0), 50000);

  return (
    <section
      className="panel"
      style={{
        marginTop: '28px',
        padding: '22px',
        borderRadius: '14px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
        color: textColor,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <p className="kicker" style={{ marginBottom: '3px' }}>
            Financial Impact &amp; Hiring Efficiency
          </p>
          <h2 style={{ margin: 0, fontSize: '21px', letterSpacing: '-0.02em' }}>
            Cost Analysis: MoM Team ROI &amp; Cost Per Hire (CPH)
          </h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '12.5px' }}>
            {selectedBu === 'all' ? 'All Business Units' : selectedBu} Â· Target Team ROI:{' '}
            <strong style={{ color: '#10b981' }}>{roiTarget}x</strong> Â· External Fee: 8.33% Â· ER Bonus: Cat A â‚¹50k / B â‚¹20k / C â‚¹7.5k
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '8px',
              background: theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${borderColor}`,
            }}
          >
            {[
              { id: 'blended', label: 'Blended CPH (Incl. Payroll)' },
              { id: 'direct', label: 'Direct CPH (Tools + ER + Ext)' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setCphMode(mode.id)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: cphMode === mode.id ? '#0284c7' : 'transparent',
                  color: cphMode === mode.id ? '#ffffff' : 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowToolsModal((prev) => !prev)}
            style={{
              height: '38px',
              padding: '0 13px',
              borderRadius: '8px',
              background: showToolsModal
                ? 'rgba(167, 139, 250, 0.2)'
                : theme === 'light'
                ? '#f8fafc'
                : 'rgba(255,255,255,0.06)',
              color: '#a78bfa',
              border: '1px solid rgba(167, 139, 250, 0.45)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            TA Tools ({toolsList.length}) Â· {formatInrShort(activeCostStore?.monthlyToolsCost || 0)}/mo
          </button>

          <select
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value)}
            aria-label="Select Cost Analysis Timeline"
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              border: '1px solid rgba(234, 179, 8, 0.55)',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            <option value="fy26_27" style={{ background: '#0f172a', color: '#fff' }}>
              FY 2026â€“27 (Apr â€™26 â€“ Mar â€™27)
            </option>
            <option value="fy25_26" style={{ background: '#0f172a', color: '#fff' }}>
              FY 2025â€“26 (Jun â€™25 â€“ Mar â€™26)
            </option>
            <option value="all_from_jun25" style={{ background: '#0f172a', color: '#fff' }}>
              All Months (Jun â€™25 â€“ Mar â€™27)
            </option>
          </select>
        </div>
      </div>

      {showToolsModal && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px 18px',
            borderRadius: '12px',
            background: theme === 'light' ? '#f5f3ff' : 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(167, 139, 250, 0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ fontSize: '14px', color: '#a78bfa' }}>
              Active TA Tool Subscriptions (`TA Tools` Tab)
            </strong>
            <span style={{ fontSize: '12.5px', color: mutedColor }}>
              Annual Total: <strong>{formatInrFull(activeCostStore?.annualToolsCost || 0)}</strong> Â· Monthly Run-Rate:{' '}
              <strong style={{ color: '#a78bfa' }}>{formatInrFull(activeCostStore?.monthlyToolsCost || 0)}/mo</strong>
            </span>
          </div>
          {toolsList.length === 0 ? (
            <p style={{ margin: 0, fontSize: '12.5px', color: mutedColor }}>
              No tool rows found in the <code>TA Tools</code> tab yet. Add Tool Name in Col A and Annual Subscription in Col B.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {toolsList.map((t, idx) => (
                <div
                  key={`${t.name}-${idx}`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: mutedColor }}>
                    Annual: <strong style={{ color: textColor }}>{formatInrShort(t.annualCost)}</strong> Â· Monthly:{' '}
                    <strong style={{ color: '#a78bfa' }}>{formatInrShort(t.monthlyCost)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top 4 Executive KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            background: subCardBg,
            border: `1px solid ${
              summary.avgTeamRoi >= roiTarget ? 'rgba(16, 185, 129, 0.4)' : 'rgba(234, 179, 8, 0.4)'
            }`,
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: mutedColor }}>
            {ytdLabel} Team ROI
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '28px',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: summary.avgTeamRoi >= roiTarget ? '#10b981' : '#eab308',
              }}
            >
              {summary.avgTeamRoi.toFixed(1)}x
            </span>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background:
                  summary.avgTeamRoi >= roiTarget
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(234, 179, 8, 0.15)',
                color: summary.avgTeamRoi >= roiTarget ? '#10b981' : '#eab308',
              }}
            >
              Target {roiTarget}x
            </span>
          </div>
          <div style={{ fontSize: '12px', color: mutedColor, marginTop: '6px' }}>
            Value Gen: <strong>{formatInrShort(summary.sumWeightedRoiVal)}</strong> vs Payroll:{' '}
            <strong>{formatInrShort(summary.sumPayroll)}</strong>
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            background: subCardBg,
            border: '1px solid rgba(56, 189, 248, 0.35)',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: mutedColor }}>
            {ytdLabel} {cphMode === 'blended' ? 'Blended CPH' : 'Direct CPH'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '28px',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: '#38bdf8',
              }}
            >
              {formatInrShort(summary.ytdCph)}
            </span>
            <span style={{ fontSize: '12px', color: mutedColor, fontWeight: 600 }}>
              across {fmt(summary.totalJoined)} hires
            </span>
          </div>
          <div style={{ fontSize: '12px', color: mutedColor, marginTop: '6px' }}>
            Total Spend: <strong>{formatInrShort(summary.sumActiveCost)}</strong> ({fmt(summary.totalFulltime)} FT Â·{' '}
            {fmt(summary.totalIntern)} Intern)
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            background: subCardBg,
            border: '1px solid rgba(167, 139, 250, 0.35)',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: mutedColor }}>
            CPH by Hiring Channel
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: mutedColor }}>Internal / Campus ({summary.internalJoined}):</span>
              <strong style={{ color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
                {formatInrShort(summary.internalCph)}/hire
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: mutedColor }}>Employee Ref. ({summary.empReferralJoined}):</span>
              <strong style={{ color: '#eab308', fontVariantNumeric: 'tabular-nums' }}>
                {formatInrShort(summary.referralCph)}/hire
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: mutedColor }}>External Agency ({summary.externalJoined}):</span>
              <strong style={{ color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                {formatInrShort(summary.externalCph)}/hire
              </strong>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            background: subCardBg,
            border: '1px solid rgba(52, 211, 153, 0.35)',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: mutedColor }}>
            Est. Agency Fees Saved (8.33%)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '28px',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: '#34d399',
              }}
            >
              {formatInrShort(summary.sumAgencySaved)}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: mutedColor, marginTop: '6px' }}>
            Saved by closing <strong>{fmt(summary.internalJoined)}</strong> roles via Internal &amp; Campus channels
          </div>
        </div>
      </div>

      {/* Visual 1: MoM Team ROI vs Cost Per Hire Interactive Dual-Trend Visual */}
      <div
        style={{
          borderRadius: '12px',
          background: subCardBg,
          border: `1px solid ${borderColor}`,
          padding: '18px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700 }}>
              MoM Team ROI (x) vs. Cost Per Hire (â‚¹)
            </h3>
            <span style={{ fontSize: '12px', color: mutedColor }}>
              Bars show monthly Cost Per Hire Â· Green line tracks Team ROI against the {roiTarget}x target benchmark
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '3px',
                  background: 'rgba(56, 189, 248, 0.45)',
                  border: '1px solid #38bdf8',
                }}
              />
              Cost Per Hire (â‚¹)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
              <span style={{ width: '10px', height: '3px', background: '#10b981', display: 'inline-block' }} />
              Team ROI (x)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#eab308' }}>
              <span
                style={{
                  width: '10px',
                  height: '2px',
                  borderTop: '2px dashed #eab308',
                  display: 'inline-block',
                }}
              />
              {roiTarget}x Target
            </span>
          </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${Math.max(680, chartData.length * 88)} 230`}
            style={{ width: '100%', minWidth: '640px', height: '230px', display: 'block' }}
          >
            {(() => {
              const svgWidth = Math.max(680, chartData.length * 88);
              const topPad = 28;
              const botPad = 38;
              const plotH = 230 - topPad - botPad;
              const targetY = topPad + plotH - (roiTarget / maxRoi) * plotH;
              return (
                <g>
                  <line
                    x1={30}
                    y1={targetY}
                    x2={svgWidth - 20}
                    y2={targetY}
                    stroke="#eab308"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                    opacity="0.7"
                  />
                  <text
                    x={svgWidth - 24}
                    y={targetY - 6}
                    textAnchor="end"
                    fill="#eab308"
                    fontSize="10.5"
                    fontWeight="700"
                  >
                    {roiTarget}x ROI Target
                  </text>
                </g>
              );
            })()}

            {chartData.map((d, idx) => {
              const svgWidth = Math.max(680, chartData.length * 88);
              const colW = (svgWidth - 60) / Math.max(1, chartData.length);
              const cx = 30 + idx * colW + colW / 2;
              const topPad = 28;
              const botPad = 38;
              const plotH = 230 - topPad - botPad;
              const barH = maxCph > 0 ? (d.activeCph / maxCph) * plotH : 0;
              const barY = topPad + plotH - barH;
              const barW = Math.min(38, colW * 0.48);

              return (
                <g key={d.month}>
                  <rect
                    x={cx - barW / 2}
                    y={barY}
                    width={barW}
                    height={Math.max(2, barH)}
                    rx="5"
                    fill="rgba(56, 189, 248, 0.25)"
                    stroke="#38bdf8"
                    strokeWidth="1"
                  />
                  {d.activeCph > 0 && (
                    <text
                      x={cx}
                      y={Math.max(14, barY - 6)}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {formatInrShort(d.activeCph)}
                    </text>
                  )}
                  <text
                    x={cx}
                    y={230 - 14}
                    textAnchor="middle"
                    fill={mutedColor}
                    fontSize="11"
                    fontWeight="600"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            {(() => {
              const svgWidth = Math.max(680, chartData.length * 88);
              const colW = (svgWidth - 60) / Math.max(1, chartData.length);
              const topPad = 28;
              const botPad = 38;
              const plotH = 230 - topPad - botPad;

              const pts = chartData.map((d, idx) => {
                const cx = 30 + idx * colW + colW / 2;
                const cy = topPad + plotH - (Math.min(d.teamRoi, maxRoi) / maxRoi) * plotH;
                return { cx, cy, roi: d.teamRoi, month: d.month };
              });

              const pathD = pts
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
                .join(' ');

              return (
                <g>
                  {pts.length > 1 && (
                    <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                  )}
                  {pts.map((p) => (
                    <g key={`pt-${p.month}`}>
                      <circle
                        cx={p.cx}
                        cy={p.cy}
                        r="4.5"
                        fill={p.roi >= roiTarget ? '#10b981' : '#eab308'}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                      {p.roi > 0 && (
                        <text
                          x={p.cx}
                          y={Math.max(14, p.cy - 9)}
                          textAnchor="middle"
                          fill={p.roi >= roiTarget ? '#10b981' : '#eab308'}
                          fontSize="11"
                          fontWeight="800"
                        >
                          {p.roi.toFixed(1)}x
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Visual 2: Sleek Borderless Monthly Cost & ROI Breakdown Table */}
      <div
        style={{
          borderRadius: '12px',
          background: subCardBg,
          border: `1px solid ${borderColor}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700 }}>
              Monthly Cost Breakdown, Team ROI &amp; CPH Matrix
            </h3>
            <span style={{ fontSize: '12px', color: mutedColor, fontWeight: 500 }}>
              Â· Fixed Payroll &amp; Tools + Col R (`Hiring Cost_ER_External`)
            </span>
          </div>
        </div>

        <div className="table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: `${260 + displayedMonths.length * 86}px`,
              borderCollapse: 'collapse',
              fontSize: '12.5px',
            }}
          >
            <thead>
              <tr style={{ background: headerBg }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '11px 16px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    background: theme === 'light' ? '#f1f5f9' : '#162033',
                    minWidth: '225px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: mutedColor,
                    borderBottom: `1px solid ${borderColor}`,
                  }}
                >
                  Cost &amp; ROI Metric
                </th>
                {monthSeries.map((m) => (
                  <th
                    key={m.month}
                    style={{
                      textAlign: 'right',
                      padding: '11px 12px',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: mutedColor,
                      borderBottom: `1px solid ${borderColor}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.label}
                  </th>
                ))}
                <th
                  style={{
                    textAlign: 'right',
                    padding: '11px 18px',
                    minWidth: '115px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#38bdf8',
                    borderBottom: `1px solid ${borderColor}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ytdLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  key: 'joined',
                  label: 'Total Joinings (FT + Intern)',
                  accent: '#38bdf8',
                  format: (v) => (v === 0 ? 'â€”' : fmt(v)),
                  ytdVal: summary.totalJoined,
                },
                {
                  key: 'teamPayrollCost',
                  label: 'TA Team Payroll (Allocated)',
                  accent: '#64748b',
                  format: (v) => (v === 0 ? 'â€”' : formatInrShort(v)),
                  ytdVal: summary.sumPayroll,
                },
                {
                  key: 'toolsCost',
                  label: 'TA Tools Subscription (Monthly)',
                  accent: '#a78bfa',
                  format: (v) => (v === 0 ? 'â€”' : formatInrShort(v)),
                  ytdVal: summary.sumTools,
                },
                {
                  key: 'empReferralCost',
                  label: 'Employee Referral Payouts (Col R)',
                  accent: '#eab308',
                  format: (v) => (v === 0 ? 'â€”' : formatInrShort(v)),
                  ytdVal: summary.sumEmpRefCost,
                },
                {
                  key: 'externalAgencyCost',
                  label: 'External Agency Fees (8.33% Col R)',
                  accent: '#f87171',
                  format: (v) => (v === 0 ? 'â€”' : formatInrShort(v)),
                  ytdVal: summary.sumExtAgencyCost,
                },
                {
                  key: 'activeTotalCost',
                  label: cphMode === 'blended' ? 'Total Blended TA Cost' : 'Total Direct Hiring Cost',
                  accent: '#38bdf8',
                  isBold: true,
                  format: (v) => (v === 0 ? 'â€”' : formatInrShort(v)),
                  ytdVal: summary.sumActiveCost,
                },
                {
                  key: 'activeCph',
                  label: cphMode === 'blended' ? 'Cost Per Hire (Blended â‚¹)' : 'Cost Per Hire (Direct â‚¹)',
                  accent: '#38bdf8',
                  isBadge: true,
                  format: (v) => (v === 0 ? 'â€”' : formatInrShort(v)),
                  ytdVal: summary.ytdCph,
                },
                {
                  key: 'teamRoi',
                  label: 'Monthly Team ROI (x)',
                  accent: '#10b981',
                  isBadge: true,
                  format: (v) => (v === 0 ? 'â€”' : `${v.toFixed(1)}x`),
                  ytdVal: summary.avgTeamRoi,
                },
                {
                  key: 'agencyCostSaved',
                  label: 'Est. Agency Fee Saved (Internal)',
                  accent: '#34d399',
                  format: (v) => (v === 0 ? 'â€”' : formatInrShort(v)),
                  ytdVal: summary.sumAgencySaved,
                },
              ].map((row) => (
                <tr key={row.key}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      background: stickyBg,
                      padding: '9px 14px 9px 18px',
                      fontWeight: row.isBold || row.isBadge ? 700 : 500,
                      color: row.isBold || row.isBadge ? textColor : mutedColor,
                      borderBottom: rowBorder,
                      boxShadow: `inset 3px 0 0 ${row.accent}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.label}
                  </td>
                  {monthSeries.map((m) => {
                    const rawVal = m[row.key] || 0;
                    return (
                      <td
                        key={m.month}
                        style={{
                          textAlign: 'right',
                          padding: '9px 12px',
                          borderBottom: rowBorder,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: row.isBold || row.isBadge ? 700 : 500,
                          color: rawVal === 0 ? mutedColor : row.isBadge ? row.accent : textColor,
                          opacity: rawVal === 0 ? 0.35 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.format(rawVal)}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '9px 18px',
                      borderBottom: rowBorder,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 800,
                      color: row.accent,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.format(row.ytdVal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------- Recruiter Performance Section ---------- */

function RecruiterPerformanceSection({
  recruiterPerformance,
  recruiterPerformanceByBu,
  recruiterPerformanceOverall,
  unitKey,
  selectedBu,
  theme,
}) {
  const [scopeMode, setScopeMode] = useState('qtd');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [channelGroup, setChannelGroup] = useState('all');

  const perfStore = useMemo(() => {
    if (selectedBu !== 'all') {
      return (recruiterPerformanceByBu && recruiterPerformanceByBu[selectedBu]) || recruiterPerformance || {};
    }
    if (unitKey === 'overall') {
      return recruiterPerformanceOverall || recruiterPerformance || {};
    }
    return recruiterPerformance || {};
  }, [recruiterPerformance, recruiterPerformanceByBu, recruiterPerformanceOverall, unitKey, selectedBu]);

  const months = perfStore?.months || [];
  useEffect(() => {
    if (months.length > 0 && (!selectedMonth || !months.includes(selectedMonth))) {
      setSelectedMonth(months[months.length - 1]);
    }
  }, [months, selectedMonth]);

  const recruiters = perfStore?.recruiters || [];
  const sheetTotalsNode = useMemo(() => {
    const base = perfStore?.sheetTotals || {};
    if (channelGroup !== 'all' && base.byChannel && base.byChannel[channelGroup]) {
      return base.byChannel[channelGroup];
    }
    return base;
  }, [perfStore, channelGroup]);

  const unlistedBucket = useMemo(() => {
    if (scopeMode === 'qtd') return sheetTotalsNode?.unlistedQtd || { offered: 0, joined: 0 };
    if (scopeMode === 'overall') return sheetTotalsNode?.unlistedOverall || { offered: 0, joined: 0 };
    return (
      (sheetTotalsNode?.unlistedByMonth && sheetTotalsNode.unlistedByMonth[selectedMonth]) || {
        offered: 0,
        joined: 0,
      }
    );
  }, [sheetTotalsNode, scopeMode, selectedMonth]);

  const directTotalBucket = useMemo(() => {
    if (scopeMode === 'qtd') return sheetTotalsNode?.qtd || { offered: 0, joined: 0 };
    if (scopeMode === 'overall') return sheetTotalsNode?.overall || { offered: 0, joined: 0 };
    return (sheetTotalsNode?.byMonth && sheetTotalsNode.byMonth[selectedMonth]) || { offered: 0, joined: 0 };
  }, [sheetTotalsNode, scopeMode, selectedMonth]);

  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';

  let sumTarget = 0;
  let sumOffered = 0;
  let sumJoined = 0;

  return (
    <section
      className="panel"
      style={{
        marginTop: '28px',
        padding: '22px',
        borderRadius: '14px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '18px',
        }}
      >
        <div>
          <p className="kicker" style={{ margin: '0 0 3px' }}>
            Target vs Achievement &amp; Confidential ROI
          </p>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Recruiter Performance &amp; ROI</h2>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <select
            value={channelGroup}
            onChange={(e) => setChannelGroup(e.target.value)}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              border: `1px solid ${borderColor}`,
              fontWeight: 600,
              fontSize: '12.5px',
            }}
          >
            <option value="all" style={{ background: '#0f172a', color: '#fff' }}>
              Channel: All Channels
            </option>
            <option value="internalGroup" style={{ background: '#0f172a', color: '#fff' }}>
              Internal / Campus / Careers
            </option>
            <option value="employeeReferral" style={{ background: '#0f172a', color: '#fff' }}>
              Employee Referral
            </option>
            <option value="businessReference" style={{ background: '#0f172a', color: '#fff' }}>
              Business Reference
            </option>
            <option value="external" style={{ background: '#0f172a', color: '#fff' }}>
              External Agency
            </option>
          </select>

          <select
            value={scopeMode}
            onChange={(e) => setScopeMode(e.target.value)}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
              color: 'inherit',
              border: `1px solid ${borderColor}`,
              fontWeight: 600,
              fontSize: '12.5px',
            }}
          >
            <option value="qtd" style={{ background: '#0f172a', color: '#fff' }}>
              Current Quarter (QTD)
            </option>
            <option value="overall" style={{ background: '#0f172a', color: '#fff' }}>
              Overall
            </option>
            <option value="month" style={{ background: '#0f172a', color: '#fff' }}>
              Single Month
            </option>
          </select>

          {scopeMode === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                background: theme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.06)',
                color: 'inherit',
                border: '1px solid rgba(56,189,248,0.45)',
                fontWeight: 600,
                fontSize: '12.5px',
              }}
            >
              {months.map((m) => (
                <option key={m} value={m} style={{ background: '#0f172a', color: '#fff' }}>
                  {formatYearMonth(m)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Recruiter</th>
              <th style={{ padding: '10px' }}>Hiring Type</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Target</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Offered</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Joined</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Achievement %</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>ROI (Target 15x)</th>
            </tr>
          </thead>
          <tbody>
            {recruiters.map((r) => {
              const chNode = (r.byChannel && r.byChannel[channelGroup]) || r;
              let stat = { offered: 0, joined: 0, roi: 0 };
              let target = r.quarterlyTarget || 0;
              if (scopeMode === 'qtd') {
                stat = chNode.qtd || stat;
                target = r.quarterlyTarget || 0;
              } else if (scopeMode === 'overall') {
                stat = chNode.overall || stat;
                target = r.overallTarget || 0;
              } else {
                stat = (chNode.byMonth && chNode.byMonth[selectedMonth]) || stat;
                target = r.monthlyTarget || 0;
              }
              sumTarget += target;
              sumOffered += stat.offered || 0;
              sumJoined += stat.joined || 0;

              const achPct = target > 0 ? Math.round((stat.joined / target) * 100) : 0;

              return (
                <tr key={r.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '10px', fontWeight: 700 }}>{r.name}</td>
                  <td style={{ padding: '10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: r.hiringType === 'Bulk' ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)',
                        color: r.hiringType === 'Bulk' ? '#f59e0b' : '#38bdf8',
                      }}
                    >
                      {r.hiringType}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(target)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#38bdf8', fontWeight: 600 }}>
                    {fmt(stat.offered)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                    {fmt(stat.joined)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{achPct}%</td>
                  <td
                    style={{
                      padding: '10px',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: (stat.roi || 0) >= 15 ? '#10b981' : '#eab308',
                    }}
                  >
                    {(stat.roi || 0).toFixed(1)}x
                  </td>
                </tr>
              );
            })}

            {(unlistedBucket.offered > 0 || unlistedBucket.joined > 0) && (
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: 0.8 }}>
                <td style={{ padding: '10px', fontStyle: 'italic' }}>Other / Unlisted Recruiters</td>
                <td style={{ padding: '10px' }}>â€”</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>â€”</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#38bdf8' }}>{fmt(unlistedBucket.offered)}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>{fmt(unlistedBucket.joined)}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>â€”</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>â€”</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr
              style={{
                fontWeight: 800,
                background: theme === 'light' ? '#f1f5f9' : '#1e293b',
                color: theme === 'light' ? '#0f172a' : '#f8fafc',
                borderTop: '2px solid rgba(56, 189, 248, 0.45)',
              }}
            >
              <td style={{ padding: '10px' }}>Team Total</td>
              <td style={{ padding: '10px' }}>â€”</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(sumTarget)}</td>
              <td style={{ padding: '10px', textAlign: 'right', color: '#38bdf8' }}>
                {fmt(directTotalBucket.offered || sumOffered)}
              </td>
              <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>
                {fmt(directTotalBucket.joined || sumJoined)}
              </td>
              <td style={{ padding: '10px', textAlign: 'right' }}>
                {sumTarget > 0 ? `${Math.round(((directTotalBucket.joined || sumJoined) / sumTarget) * 100)}%` : 'â€”'}
              </td>
              <td style={{ padding: '10px', textAlign: 'right' }}>â€”</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ---------- Main Dashboard Component ---------- */

export default function Dashboard() {
  const [unitKey, setUnitKey] = useState('overall');
  const [selectedBu, setSelectedBu] = useState('all');
  const [allUnitsData, setAllUnitsData] = useState({ mu: null, tetr: null });
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');

  // Expanded BU rows & Modals
  const [expandedBuMap, setExpandedBuMap] = useState({});
  const [showTotalPosModal, setShowTotalPosModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCvLess5Modal, setShowCvLess5Modal] = useState(false);
  const [selectedJobForCandidates, setSelectedJobForCandidates] = useState(null);

  // Job table filters
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobHealthFilter, setJobHealthFilter] = useState('all');
  const [replacementOnly, setReplacementOnly] = useState(false);
  const [cvLess5Only, setCvLess5Only] = useState(false);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const stamp = Date.now();
      const [muRes, tetrRes] = await Promise.all([
        fetch(`/data/mu.json?t=${stamp}`, { cache: 'no-store' }),
        fetch(`/data/tetr.json?t=${stamp}`, { cache: 'no-store' }),
      ]);
      const muJson = muRes.ok ? await muRes.json() : null;
      const tetrJson = tetrRes.ok ? await tetrRes.json() : null;
      setAllUnitsData({ mu: muJson, tetr: tetrJson });
    } catch (err) {
      console.error('Error loading TA data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    setSelectedBu('all');
  }, [unitKey]);

  const overallData = useMemo(() => {
    const muData = allUnitsData.mu;
    const tetrData = allUnitsData.tetr;
    if (!muData && !tetrData) return null;
    if (!muData) return tetrData;
    if (!tetrData) return muData;

    const mergedBus = [...(muData.businessUnits || []), ...(tetrData.businessUnits || [])];
    const mergedJobs = [...(muData.jobs || []), ...(tetrData.jobs || [])];

    // Merge MoM Series
    const momMap = {};
    [...(muData.momSeries || []), ...(tetrData.momSeries || [])].forEach((m) => {
      if (!momMap[m.month]) {
        momMap[m.month] = {
          month: m.month,
          offered: 0,
          joined: 0,
          byBu: {},
          offeredCandidates: [],
          joinedCandidates: [],
        };
      }
      momMap[m.month].offered += m.offered || 0;
      momMap[m.month].joined += m.joined || 0;
      Object.assign(momMap[m.month].byBu, m.byBu || {});
      momMap[m.month].offeredCandidates.push(...(m.offeredCandidates || []));
      momMap[m.month].joinedCandidates.push(...(m.joinedCandidates || []));
    });

    // Merge Channel Breakdowns & Efficiency
    const mergedChannelBreakdown = mergeCountMaps(muData.channelBreakdown, tetrData.channelBreakdown);
    const mergedCurrentChannelBreakdown = mergeCountMaps(
      muData.currentChannelBreakdown,
      tetrData.currentChannelBreakdown
    );
    const mergedEffOverall = mergeEffMaps(muData.channelEfficiencyOverall, tetrData.channelEfficiencyOverall);

    const mergedEffMonthly = {};
    const effMonths = new Set([
      ...Object.keys(muData.channelEfficiencyMonthly || {}),
      ...Object.keys(tetrData.channelEfficiencyMonthly || {}),
    ]);
    effMonths.forEach((ym) => {
      mergedEffMonthly[ym] = mergeEffMaps(
        muData.channelEfficiencyMonthly && muData.channelEfficiencyMonthly[ym],
        tetrData.channelEfficiencyMonthly && tetrData.channelEfficiencyMonthly[ym]
      );
    });

    // Merge Channel MoM Series
    const cMomMap = {};
    [...(muData.channelMomSeries || []), ...(tetrData.channelMomSeries || [])].forEach((row) => {
      if (!cMomMap[row.month]) {
        cMomMap[row.month] = {
          month: row.month,
          internalGroup: 0,
          businessReference: 0,
          external: 0,
          totalJoined: 0,
        };
      }
      cMomMap[row.month].internalGroup += row.internalGroup || 0;
      cMomMap[row.month].businessReference += row.businessReference || 0;
      cMomMap[row.month].external += row.external || 0;
      cMomMap[row.month].totalJoined += row.totalJoined || 0;
    });
    const mergedChannelMomSeries = Object.keys(cMomMap)
      .sort()
      .map((ym) => {
        const o = cMomMap[ym];
        return {
          ...o,
          externalPct: o.totalJoined > 0 ? Math.round((o.external / o.totalJoined) * 1000) / 10 : 0,
        };
      });

    // Merge Funnel Analytics
    const fMu = muData.funnelAnalytics || {};
    const fTetr = tetrData.funnelAnalytics || {};
    const mergedRecruiters = Array.from(
      new Set([...(fMu.recruiters || []), ...(fTetr.recruiters || [])])
    ).sort();

    const mergedByRecruiter = {};
    mergedRecruiters.forEach((r) => {
      mergedByRecruiter[r] = mergeFunnelMonthMaps(
        fMu.byRecruiter && fMu.byRecruiter[r],
        fTetr.byRecruiter && fTetr.byRecruiter[r]
      );
    });

    const mergedFunnelAnalytics = {
      recruiters: mergedRecruiters,
      byMonth: mergeFunnelMonthMaps(fMu.byMonth, fTetr.byMonth),
      byBu: { ...(fMu.byBu || {}), ...(fTetr.byBu || {}) },
      byRecruiter: mergedByRecruiter,
      byBuAndRecruiter: { ...(fMu.byBuAndRecruiter || {}), ...(fTetr.byBuAndRecruiter || {}) },
    };

    const mergedCostAnalytics = {
      ...(muData.costAnalyticsOverall || muData.costAnalytics || {}),
      byMonth:
        (muData.costAnalyticsOverall && muData.costAnalyticsOverall.byMonth) ||
        (muData.costAnalytics && muData.costAnalytics.byMonth) ||
        {},
      byBu: {
        ...((muData.costAnalytics && muData.costAnalytics.byBu) || {}),
        ...((tetrData.costAnalytics && tetrData.costAnalytics.byBu) || {}),
      },
    };

    return {
      unit: { key: 'overall', name: "Overall (Masters' Union & TETR)", short: 'Overall' },
      businessUnits: mergedBus,
      jobs: mergedJobs,
      momSeries: Object.keys(momMap)
        .sort()
        .map((k) => momMap[k]),
      channelBreakdown: mergedChannelBreakdown,
      channelBreakdownByBu: {
        ...(muData.channelBreakdownByBu || {}),
        ...(tetrData.channelBreakdownByBu || {}),
      },
      currentChannelBreakdown: mergedCurrentChannelBreakdown,
      currentChannelBreakdownByBu: {
        ...(muData.currentChannelBreakdownByBu || {}),
        ...(tetrData.currentChannelBreakdownByBu || {}),
      },
      channelEfficiencyOverall: mergedEffOverall,
      channelEfficiencyOverallByBu: {
        ...(muData.channelEfficiencyOverallByBu || {}),
        ...(tetrData.channelEfficiencyOverallByBu || {}),
      },
      channelEfficiencyMonthly: mergedEffMonthly,
      channelEfficiencyMonthlyByBu: {
        ...(muData.channelEfficiencyMonthlyByBu || {}),
        ...(tetrData.channelEfficiencyMonthlyByBu || {}),
      },
      channelMomSeries: mergedChannelMomSeries,
      channelMomByBu: {
        ...(muData.channelMomByBu || {}),
        ...(tetrData.channelMomByBu || {}),
      },
      funnelAnalytics: mergedFunnelAnalytics,
      costAnalytics: mergedCostAnalytics,
      costAnalyticsOverall: muData.costAnalyticsOverall || tetrData.costAnalyticsOverall,
      recruiterPerformance: muData.recruiterPerformanceOverall || muData.recruiterPerformance,
      recruiterPerformanceByBu: {
        ...(muData.recruiterPerformanceByBu || {}),
        ...(tetrData.recruiterPerformanceByBu || {}),
      },
      recruiterPerformanceOverall: muData.recruiterPerformanceOverall || tetrData.recruiterPerformanceOverall,
      fetchedAt: muData.fetchedAt || tetrData.fetchedAt,
    };
  }, [allUnitsData]);

  const unitData = useMemo(() => {
    if (unitKey === 'overall') return overallData;
    return allUnitsData[unitKey] || null;
  }, [unitKey, overallData, allUnitsData]);

  const filteredBus = useMemo(() => {
    const list = unitData?.businessUnits || [];
    if (selectedBu === 'all') return list;
    return list.filter((b) => b.label === selectedBu);
  }, [unitData, selectedBu]);

  const filteredJobs = useMemo(() => {
    const list = unitData?.jobs || [];
    if (selectedBu === 'all') return list;
    return list.filter((j) => j.businessUnit === selectedBu);
  }, [unitData, selectedBu]);

  const kpi = useMemo(() => {
    return filteredBus.reduce(
      (acc, b) => {
        const m = b.manpower || {};
        acc.total += m.total || 0;
        acc.yetToOffer += m.yetToOffer || 0;
        acc.offered += m.offered || 0;
        acc.joined += m.joined || 0;
        acc.pending += m.pending || 0;
        acc.cvLess5Count += m.cvLess5Count || 0;
        acc.replacement += m.replacement || 0;
        return acc;
      },
      { total: 0, yetToOffer: 0, offered: 0, joined: 0, pending: 0, cvLess5Count: 0, replacement: 0 }
    );
  }, [filteredBus]);

  const toggleBuExpand = (buLabel) => {
    setExpandedBuMap((prev) => ({ ...prev, [buLabel]: !prev[buLabel] }));
  };

  const bgMain = theme === 'light' ? '#f1f5f9' : '#090d16';
  const textMain = theme === 'light' ? '#0f172a' : '#f8fafc';
  const cardBg = theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
  const borderColor = theme === 'light' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: bgMain,
        color: textMain,
        padding: '24px 28px 60px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style jsx global>{`
        .kicker {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #38bdf8;
        }
        .muted {
          color: #94a3b8;
        }
        .table-scroll::-webkit-scrollbar {
          height: 7px;
          width: 7px;
        }
        .table-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 999px;
        }
      `}</style>

      <AccessGate theme={theme}>
        {/* Top Bar */}
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div>
            <p className="kicker" style={{ margin: '0 0 4px' }}>
              Talent Acquisition Command Center
            </p>
            <h1 style={{ margin: 0, fontSize: '26px', letterSpacing: '-0.02em' }}>
              {unitData?.unit?.name || 'TA Dashboard'}
            </h1>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${borderColor}`,
              }}
            >
              {[
                { key: 'overall', label: 'Overall' },
                { key: 'mu', label: "Masters' Union" },
                { key: 'tetr', label: 'TETR' },
              ].map((u) => (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => setUnitKey(u.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: unitKey === u.key ? '#0284c7' : 'transparent',
                    color: unitKey === u.key ? '#fff' : 'inherit',
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>

            <select
              value={selectedBu}
              onChange={(e) => setSelectedBu(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                background: cardBg,
                color: 'inherit',
                border: `1px solid ${borderColor}`,
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ background: '#0f172a', color: '#fff' }}>
                All Business Units
              </option>
              {(unitData?.businessUnits || []).map((b) => (
                <option key={b.label} value={b.label} style={{ background: '#0f172a', color: '#fff' }}>
                  {b.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={fetchAllData}
              style={{
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                background: cardBg,
                color: 'inherit',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Refreshingâ€¦' : 'â†» Refresh data'}
            </button>

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                background: cardBg,
                color: 'inherit',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? 'â˜€ Light' : 'ðŸŒ™ Dark'}
            </button>
          </div>
        </header>

        {/* Top KPI Cards */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
            gap: '14px',
            marginBottom: '26px',
          }}
        >
          <div
            onClick={() => setShowTotalPosModal(true)}
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: cardBg,
              border: '1px solid rgba(56, 189, 248, 0.35)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#38bdf8',
              }}
            >
              <span>Total Positions</span>
              <span>Split â†’</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '6px' }}>{fmt(kpi.total)}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Click for Ad-Hoc / Approved / C/F</div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: cardBg,
              border: `1px solid ${borderColor}`,
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
              Yet to Offer
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '6px', color: '#818cf8' }}>
              {fmt(kpi.yetToOffer)}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {pct(kpi.yetToOffer, kpi.total)} of total
            </div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: cardBg,
              border: `1px solid ${borderColor}`,
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
              Offered
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '6px', color: '#38bdf8' }}>
              {fmt(kpi.offered)}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {pct(kpi.offered, kpi.total)} of total
            </div>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: cardBg,
              border: `1px solid ${borderColor}`,
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
              Joined
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '6px', color: '#10b981' }}>
              {fmt(kpi.joined)}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {pct(kpi.joined, kpi.total)} of total
            </div>
          </div>

          <div
            onClick={() => setShowPendingModal(true)}
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: cardBg,
              border: '1px solid rgba(234, 179, 8, 0.45)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#eab308',
              }}
            >
              <span>Pending Positions</span>
              <span>Health â†’</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '6px', color: '#eab308' }}>
              {fmt(kpi.pending)}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Click for On Track / Delayed / Critical
            </div>
          </div>

          <div
            onClick={() => setShowCvLess5Modal(true)}
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              background: cardBg,
              border: '1px solid rgba(244, 114, 182, 0.45)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#f472b6',
              }}
            >
              <span>CV &lt; 5 Roles</span>
              <span>View â†’</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '6px', color: '#f472b6' }}>
              {fmt(kpi.cvLess5Count)}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Low pipeline checker</div>
          </div>
        </section>

        {/* Manpower by Business Unit Table */}
        <section
          className="panel"
          style={{
            padding: '22px',
            borderRadius: '14px',
            background: cardBg,
            border: `1px solid ${borderColor}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <p className="kicker" style={{ margin: '0 0 3px' }}>
                Click any Business Unit row to expand roles Â· Click a role to inspect candidates
              </p>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Manpower by Business Unit</h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  border: `1px solid ${borderColor}`,
                  fontSize: '12.5px',
                }}
              >
                <option value="all" style={{ background: '#0f172a', color: '#fff' }}>
                  Job Status: All
                </option>
                <option value="open" style={{ background: '#0f172a', color: '#fff' }}>
                  Open
                </option>
                <option value="need to close" style={{ background: '#0f172a', color: '#fff' }}>
                  Need to Close
                </option>
                <option value="closed" style={{ background: '#0f172a', color: '#fff' }}>
                  Closed
                </option>
              </select>

              <select
                value={jobHealthFilter}
                onChange={(e) => setJobHealthFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  border: `1px solid ${borderColor}`,
                  fontSize: '12.5px',
                }}
              >
                <option value="all" style={{ background: '#0f172a', color: '#fff' }}>
                  Job Health: All
                </option>
                <option value="On Track" style={{ background: '#0f172a', color: '#fff' }}>
                  On Track
                </option>
                <option value="Delayed" style={{ background: '#0f172a', color: '#fff' }}>
                  Delayed
                </option>
                <option value="Critical" style={{ background: '#0f172a', color: '#fff' }}>
                  Critical
                </option>
              </select>

              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={replacementOnly}
                  onChange={(e) => setReplacementOnly(e.target.checked)}
                />
                Replacement Roles Only
              </label>

              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={cvLess5Only}
                  onChange={(e) => setCvLess5Only(e.target.checked)}
                />
                CV &lt; 5 Only
              </label>
            </div>
          </div>

          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="bu-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}`, textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Business Unit</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Total Positions</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Yet to Offer</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Offered</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Joined</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#eab308' }}>Pending</th>
                  <th style={{ padding: '10px', textAlign: 'right', color: '#f472b6' }}>CV &lt; 5</th>
                </tr>
              </thead>
              <tbody>
                {filteredBus.map((b) => {
                  const m = b.manpower || {};
                  const isExp = !!expandedBuMap[b.label];
                  const buJobs = (unitData?.jobs || []).filter((j) => {
                    if (j.businessUnit !== b.label) return false;
                    if (jobStatusFilter !== 'all' && norm(j.status) !== norm(jobStatusFilter)) return false;
                    if (jobHealthFilter !== 'all' && j.jobHealth !== jobHealthFilter) return false;
                    if (replacementOnly && !j.isReplacement) return false;
                    if (cvLess5Only && !j.cvLess5) return false;
                    return true;
                  });

                  return (
                    <Fragment key={b.label}>
                      <tr
                        onClick={() => toggleBuExpand(b.label)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer',
                          background: isExp ? 'rgba(56, 189, 248, 0.06)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '11px 10px', fontWeight: 700 }}>
                          <span style={{ marginRight: '8px', color: '#38bdf8' }}>{isExp ? 'â–¾' : 'â–¸'}</span>
                          {b.label}
                        </td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 700 }}>{fmt(m.total)}</td>
                        <td style={{ padding: '11px 10px', textAlign: 'right' }}>{fmt(m.yetToOffer)}</td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', color: '#38bdf8' }}>{fmt(m.offered)}</td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                          {fmt(m.joined)}
                        </td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', color: '#eab308', fontWeight: 700 }}>
                          {fmt(m.pending)}
                        </td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', color: '#f472b6', fontWeight: 700 }}>
                          {fmt(m.cvLess5Count)}
                        </td>
                      </tr>
                      {isExp && (
                        <tr>
                          <td colSpan={7} style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.55)' }}>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                  <tr
                                    style={{
                                      borderBottom: `1px solid ${borderColor}`,
                                      textAlign: 'left',
                                      color: '#94a3b8',
                                    }}
                                  >
                                    <th style={{ padding: '7px' }}>Job ID</th>
                                    <th style={{ padding: '7px' }}>Role (Col O)</th>
                                    <th style={{ padding: '7px' }}>Department</th>
                                    <th style={{ padding: '7px' }}>Status</th>
                                    <th style={{ padding: '7px' }}>Job Health</th>
                                    <th style={{ padding: '7px' }}>Target Date</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>ToF</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>TA Short.</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>R1</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>R2</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>R3</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>Total</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>Offered</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>Joined</th>
                                    <th style={{ padding: '7px', textAlign: 'right' }}>Pending</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {buJobs.map((j, idx) => {
                                    const hs = getJobHealthBadgeStyle(j.jobHealth);
                                    return (
                                      <tr
                                        key={`${j.jobId}-${idx}`}
                                        onClick={() => setSelectedJobForCandidates(j)}
                                        style={{
                                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <td style={{ padding: '7px', fontWeight: 600, color: '#38bdf8' }}>{j.jobId}</td>
                                        <td style={{ padding: '7px', fontWeight: 600 }}>
                                          {j.role || 'â€”'}
                                          {j.isReplacement && (
                                            <span
                                              style={{
                                                marginLeft: '6px',
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                background: 'rgba(245,158,11,0.2)',
                                                color: '#f59e0b',
                                              }}
                                            >
                                              Replacement
                                            </span>
                                          )}
                                          {j.cvLess5 && (
                                            <span
                                              style={{
                                                marginLeft: '6px',
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                background: 'rgba(244,114,182,0.2)',
                                                color: '#f472b6',
                                              }}
                                            >
                                              CV&lt;5
                                            </span>
                                          )}
                                        </td>
                                        <td style={{ padding: '7px' }}>{j.department || 'â€”'}</td>
                                        <td style={{ padding: '7px' }}>{j.status || 'â€”'}</td>
                                        <td style={{ padding: '7px' }}>
                                          <span
                                            style={{
                                              padding: '2px 7px',
                                              borderRadius: '999px',
                                              fontSize: '10.5px',
                                              fontWeight: 700,
                                              color: hs.color,
                                              background: hs.bg,
                                              border: `1px solid ${hs.border}`,
                                            }}
                                          >
                                            {j.jobHealth || 'â€”'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '7px' }}>{j.targetDate || 'â€”'}</td>
                                        <td style={{ padding: '7px', textAlign: 'right' }}>{fmt(j.topOfFunnel)}</td>
                                        <td style={{ padding: '7px', textAlign: 'right' }}>{fmt(j.taShortlisted)}</td>
                                        <td style={{ padding: '7px', textAlign: 'right' }}>{fmt(j.candidatesR1)}</td>
                                        <td style={{ padding: '7px', textAlign: 'right' }}>{fmt(j.candidatesR2)}</td>
                                        <td style={{ padding: '7px', textAlign: 'right' }}>{fmt(j.candidatesR3)}</td>
                                        <td style={{ padding: '7px', textAlign: 'right' }}>{fmt(j.total)}</td>
                                        <td style={{ padding: '7px', textAlign: 'right', color: '#38bdf8' }}>
                                          {fmt(j.offered)}
                                        </td>
                                        <td style={{ padding: '7px', textAlign: 'right', color: '#10b981' }}>
                                          {fmt(j.joined)}
                                        </td>
                                        <td
                                          style={{
                                            padding: '7px',
                                            textAlign: 'right',
                                            color: '#eab308',
                                            fontWeight: 700,
                                          }}
                                        >
                                          {fmt(j.pending)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    fontWeight: 800,
                    background: theme === 'light' ? '#f1f5f9' : '#1e293b',
                    color: theme === 'light' ? '#0f172a' : '#f8fafc',
                    borderTop: '2px solid rgba(56, 189, 248, 0.45)',
                  }}
                >
                  <td style={{ padding: '11px 10px' }}>Grand Total</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right' }}>{fmt(kpi.total)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right' }}>{fmt(kpi.yetToOffer)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: '#38bdf8' }}>{fmt(kpi.offered)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: '#10b981' }}>{fmt(kpi.joined)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: '#eab308' }}>{fmt(kpi.pending)}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: '#f472b6' }}>
                    {fmt(kpi.cvLess5Count)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Month-on-Month Offered vs. Joined */}
        <MomOfferedJoinedSection
          momSeries={unitData?.momSeries}
          selectedBu={selectedBu}
          theme={theme}
        />

        {/* Channel Breakdown & Channel Efficiency */}
        <ChannelAnalyticsSection
          unitData={unitData}
          selectedBu={selectedBu}
          theme={theme}
        />

        {/* Stage-Wise Recruitment Funnel & Joining Bifurcation */}
        <RecruitmentFunnelAndBifurcationSection
          funnelAnalytics={unitData?.funnelAnalytics}
          selectedBu={selectedBu}
          theme={theme}
        />

        {/* Cost Analysis: MoM Team ROI & Cost Per Hire (CPH) */}
        <CostAndRoiAnalyticsSection
          costAnalytics={unitData?.costAnalytics}
          costAnalyticsOverall={
            unitData?.costAnalyticsOverall ||
            allUnitsData?.mu?.costAnalyticsOverall ||
            allUnitsData?.tetr?.costAnalyticsOverall
          }
          unitKey={unitKey}
          selectedBu={selectedBu}
          theme={theme}
        />

        {/* Recruiter Performance & ROI */}
        <RecruiterPerformanceSection
          recruiterPerformance={unitData?.recruiterPerformance}
          recruiterPerformanceByBu={unitData?.recruiterPerformanceByBu}
          recruiterPerformanceOverall={unitData?.recruiterPerformanceOverall}
          unitKey={unitKey}
          selectedBu={selectedBu}
          theme={theme}
        />

        {/* Modals */}
        <TotalPositionsModal
          isOpen={showTotalPosModal}
          onClose={() => setShowTotalPosModal(false)}
          businessUnits={filteredBus}
          unitName={unitData?.unit?.name || 'Overall'}
          theme={theme}
        />

        <PendingPositionsModal
          isOpen={showPendingModal}
          onClose={() => setShowPendingModal(false)}
          businessUnits={filteredBus}
          jobs={filteredJobs}
          unitName={unitData?.unit?.name || 'Overall'}
          kpi={kpi}
          theme={theme}
        />

        <CvLess5Modal
          isOpen={showCvLess5Modal}
          onClose={() => setShowCvLess5Modal(false)}
          jobs={filteredJobs}
          unitName={unitData?.unit?.name || 'Overall'}
          theme={theme}
        />

        <JobCandidatesModal
          job={selectedJobForCandidates}
          onClose={() => setSelectedJobForCandidates(null)}
          theme={theme}
        />
      </AccessGate>
    </div>
  );
}
