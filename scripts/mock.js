// Generated sample data for local testing (MOCK_DATA=1). Not used in production.
// It deliberately includes JOB_10, an unmapped Business Unit and look-alike names
// so the exact-match and exclusion rules get exercised.

const UNITS = {
  mu: { businessUnits: [
    { sheetName: 'Central Functions (CF)' }, { sheetName: 'PG Programme (PGP)' },
    { sheetName: 'PG Programme (Bharat) (PGP_B)' }, { sheetName: 'UG Programme (UGP)' },
    { sheetName: 'Executive Education (Exec. Education)' } ] },
  tetr: { businessUnits: [
    { sheetName: 'TETR Central Function (TETR CF)' }, { sheetName: 'TETR UG Programme (TETR_UG)' },
    { sheetName: 'TETR PG Programme (TETR_PG)' }, { sheetName: 'TETR Executive Programme (TETR_EE)' } ] },
};

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const pad = (n) => String(n).padStart(2, '0');

export function generateMock() {
  const r = rng(42);
  const departments = ['Admissions', 'Marketing', 'Operations', 'Placements', 'Student Experience', 'HR'];
  const roles = ['Manager', 'Senior Executive', 'Associate Director', 'Executive', 'Admission Counsellor'];
  const statuses = ['Open', 'Open', 'Open', 'Closed', 'Need to Close'];

  const manpower = [
    { 'Job ID': 'JOB_10', 'Business Unit': '', Department: 'Talent Acquisition', 'Job Status': 'Open', Category: 'C' },
  ];
  const jobsByBU = [];
  let jobNo = 600;
  for (const unit of Object.values(UNITS)) {
    for (const bu of unit.businessUnits) {
      if (bu.sheetName === 'PG Programme (Bharat) (PGP_B)') continue; // no jobs yet, like the real sheet
      const n = 6 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const total = 1 + Math.floor(r() * 5);
        const joined = Math.floor(r() * (total + 1));
        const offered = Math.floor(r() * (total - joined + 1));
        const job = {
          'Job ID': `JOB_${jobNo++}`,
          'Business Unit': bu.sheetName,
          Department: pick(r, departments),
          'Job Status': pick(r, statuses),
          'Total Positions': String(total),
          Replacement: String(Math.floor(r() * 2)),
          'Yet to Offer': String(Math.floor(r() * 2)),
          Offered: String(offered),
          Joined: String(joined),
          'Pending Positions': String(total - offered - joined),
          Category: pick(r, ['A', 'B', 'C']),
          _role: `${pick(r, roles)} - ${pick(r, departments)}`,
        };
        manpower.push(job);
        jobsByBU.push(job);
      }
    }
  }
  // One deliberately inconsistent row and one in a Business Unit that belongs to neither unit.
  manpower.push({
    'Job ID': 'JOB_791', 'Business Unit': 'TETR PG Programme (TETR_PG)', Department: 'Admissions',
    'Job Status': 'Open', 'Total Positions': '3', Replacement: '0', 'Yet to Offer': '4',
    Offered: '1', Joined: '0', 'Pending Positions': '2', Category: 'A',
  });
  manpower.push({
    'Job ID': 'JOB_999', 'Business Unit': 'Some Other Unit (SOU)', Department: 'Admissions',
    'Job Status': 'Open', 'Total Positions': '9', Replacement: '0', 'Yet to Offer': '0',
    Offered: '0', Joined: '0', 'Pending Positions': '9', Category: 'C',
  });

  const stages = ['Shortlisting', 'Screening', 'Stage 1', 'Stage 2', 'Stage 3', 'Offered', 'Joined', 'Rejected'];
  const stageWeights = [30, 25, 15, 9, 5, 6, 4, 22];
  const sources = [
    ['Naukri', 'Job Portal'], ['LinkedIn', 'Job Portal'], ['Indeed', 'Job Portal'],
    ['Employee Referral', 'Referral'], ['Careers Page', 'Direct'], ['Agency A', 'Agency'],
  ];
  const recruiters = ['Shipra Jaiswal (29453)', 'Ekta Bhardwaj (28753)', 'Raja Kumar Roy (30083)', 'Neha Arora (27111)'];
  const weighted = () => {
    const total = stageWeights.reduce((a, b) => a + b, 0);
    let x = r() * total;
    for (let i = 0; i < stages.length; i++) {
      x -= stageWeights[i];
      if (x <= 0) return stages[i];
    }
    return stages[0];
  };

  const candidates = [];
  const today = new Date();
  let cid = 30000;
  for (let i = 0; i < 2500; i++) {
    const job = pick(r, jobsByBU);
    const d = new Date(today.getTime() - Math.floor(r() * 110) * 86400000);
    const [src, srcType] = pick(r, sources);
    candidates.push({
      'Candidate Id': `CAD_${cid++}`,
      'Date Of Application': `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`,
      'Source By': pick(r, recruiters),
      'Job Id': job['Job ID'],
      'Job Name': job._role,
      'Business Unit': job['Business Unit'],
      Department: job.Department,
      'Candidate Source Name': src,
      'Candidate Source Type': srcType,
      'Pre-Offer Status': pick(r, ['Not Initiated', 'Not Initiated', 'Initiated', 'Approved']),
      'Candidate Status': weighted(),
    });
  }
  // JOB_10 candidates must be ignored too.
  for (let i = 0; i < 25; i++) {
    candidates.push({
      'Candidate Id': `CAD_${cid++}`, 'Date Of Application': '20-10-2026', 'Source By': recruiters[0],
      'Job Id': 'JOB_10', 'Job Name': 'TA Associate', 'Business Unit': 'Central Functions (CF)',
      Department: 'Talent Acquisition', 'Candidate Source Name': 'Naukri', 'Candidate Source Type': 'Job Portal',
      'Pre-Offer Status': 'Not Initiated', 'Candidate Status': 'Screening',
    });
  }
  return { manpower: manpower.map(({ _role, ...rest }) => rest), candidates };
}
