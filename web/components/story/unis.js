// Universities on the homepage: the tabs, the colours each one switches the page to, and the copy and figures that
// change with it. Plain JS (shared by story.js and the React components). Figures here are fallbacks: the live counts
// come from public_uni_stats() (Supabase) as soon as the page loads.
//
// Colours: UCL dark purple #361A54 / bright purple #993BFF / mid purple #BA82FF (UCL brand guidelines, 2025);
// Imperial blue #003E74 (PMS 541); Queen Mary dark blue #21376A with dark purple #7B0E72 (QM technical guidance);
// LSE red with black.

export const UNI_IDS = ['ucl', 'imperial', 'qmul', 'lse'];
export const UNI_KEY = 'unizy:uni';

export const UNIS = {
  ucl: {
    short: 'UCL', name: 'University College London', poss: 'UCL’s', bands: 'UCL’s grade bands', tutor: 'Professor UCL',
    src: 'from the official catalogue', depts: 'departments covered', unit: 'departments', modWord: 'modules',
    stats: { modules: 6682, departments: 81, rubrics: 10 },
    course: ['Economics BSc · Year 1', [['ECON0013', 'Microeconomics', 1], ['ECON0019', 'Quantitative Economics', 1], ['HIST0003', 'Approaching History', 1], ['POLS0006', 'Introduction to Politics', 0]]],
    book: ['ECON0013', 'Microeconomics'],
    tags: ['ECON0013', 'HIST0003', 'LAWS0001'],
    mods: [['ECON0013', 'Microeconomics'], ['HIST0003', 'Approaching History'], ['POLS0006', 'Introduction to Politics'], ['LAWS0001', 'Contract Law'], ['COMP0002', 'Principles of Programming'], ['STAT0002', 'Probability and Statistics'], ['ANAT0001', 'Anatomy and Development'], ['PHIL0001', 'Ancient Greek Philosophy'], ['ELEC0002', 'Electronic Engineering'], ['BIOL0001', 'Quantitative Biology']],
    pat: ['#C9A6FF', '#2A1342'],
  },
  imperial: {
    short: 'Imperial', name: 'Imperial College London', poss: 'Imperial’s', bands: 'Imperial’s class bands', tutor: 'Professor Imperial',
    src: 'from the programme specifications', depts: 'departments covered', unit: 'departments', modWord: 'modules',
    stats: { modules: 1180, departments: 18, rubrics: 12 },
    course: ['Economics, Finance and Data Science BSc · Year 1', [['BUSI40006', 'Microeconomics 1', 1], ['BUSI40007', 'Macroeconomics 1', 1], ['BUSI40002', 'Probability and Statistics', 1], ['BUSI40003', 'Introduction to Data Science', 0]]],
    book: ['BUSI40006', 'Microeconomics 1'],
    tags: ['MATH40001', 'COMP40008', 'MECH40001'],
    mods: [['MATH40001', 'Introduction to University Mathematics'], ['COMP40008', 'Graphs and Algorithms'], ['PHYS40002', 'Mechanics and Relativity'], ['AERO40001', 'Aerodynamics 1'], ['ELEC40002', 'Analysis and Design of Circuits'], ['LIFE40001', 'Biological Chemistry'], ['MEDI40001', 'Principles of Medicine'], ['EART40001', 'Dynamic Earth and Planets'], ['BIOE40001', 'Bioengineering Science 1'], ['BUSI40006', 'Microeconomics 1']],
    pat: ['#9DCBFF', '#06264A'],
  },
  qmul: {
    short: 'Queen Mary', name: 'Queen Mary University of London', poss: 'Queen Mary’s', bands: 'Queen Mary’s class bands', tutor: 'Professor QMUL',
    src: 'from the module directory', depts: 'schools and institutes', unit: 'schools', modWord: 'modules',
    stats: { modules: 2194, departments: 20, rubrics: 2 },
    course: ['Economics BSc · Year 1', [['ECN111', 'Microeconomics I', 1], ['ECN106', 'Macroeconomics I', 1], ['ECN115', 'Mathematical Methods in Economics and Finance', 1], ['ECN121', 'Statistical Methods in Economics', 0]]],
    book: ['ECN111', 'Microeconomics I'],
    tags: ['ECN111', 'HST4000U', 'LAW4001'],
    mods: [['ECN111', 'Microeconomics I'], ['LAW4001', 'Public Law'], ['HST4000U', 'Europe since 1800'], ['MTH4000', 'Programming in Python I'], ['BBC4108', 'Data Structures'], ['ICM4901', 'Cells'], ['BDS4008', 'Basic Sciences for Dentistry 1'], ['BUS4002U', 'Fundamentals of Management'], ['EMS4002U', 'Engineering and Materials Chemistry'], ['ECN115', 'Mathematical Methods in Economics and Finance']],
    pat: ['#E7A8E0', '#16264D'],
  },
  lse: {
    short: 'LSE', name: 'London School of Economics', poss: 'LSE’s', bands: 'LSE’s marking scale', tutor: 'Professor LSE',
    src: 'from the Calendar', depts: 'departments and units', unit: 'departments', modWord: 'courses',
    stats: { modules: 579, departments: 21, rubrics: 12 },
    course: ['BSc Economics · Year 1', [['EC1A3', 'Microeconomics I', 1], ['EC1B3', 'Macroeconomics I', 1], ['MA100', 'Mathematical Methods', 1], ['ST109', 'Elementary Statistical Theory I', 0]]],
    book: ['EC1A3', 'Microeconomics I'],
    tags: ['EC1A3', 'GV100', 'MA100'],
    mods: [['EC1A3', 'Microeconomics I'], ['GV100', 'Introduction to Political Theory'], ['MA100', 'Mathematical Methods'], ['AC102', 'Elements of Financial Accounting'], ['AN101', 'A History of Anthropological Theory'], ['EH102', 'Pre-industrial Economic History'], ['FM101', 'Finance'], ['GY100', 'Introduction to Geography'], ['PB100', 'Foundations of Behavioural Science'], ['PH111', 'Introduction to Logic']],
    pat: ['#FFB3B6', '#1A1A1A'],
  },
};

const ALL_MODS = [['ECON0013', 'Microeconomics'], ['MATH40001', 'Introduction to University Mathematics'], ['LAW4001', 'Public Law'], ['EC1A3', 'Microeconomics I'], ['HIST0003', 'Approaching History'], ['COMP40008', 'Graphs and Algorithms'], ['HST4000U', 'Europe since 1800'], ['GV100', 'Introduction to Political Theory'], ['LAWS0001', 'Contract Law'], ['PHYS40002', 'Mechanics and Relativity']];

export function getUni() {
  try { const u = localStorage.getItem(UNI_KEY); return UNI_IDS.indexOf(u) >= 0 ? u : ''; } catch (e) { return ''; }
}
// '' = all universities (Unizy's own colours)
export function setUni(u) {
  u = UNI_IDS.indexOf(u) >= 0 ? u : '';
  try { if (u) localStorage.setItem(UNI_KEY, u); else localStorage.removeItem(UNI_KEY); } catch (e) {}
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-uni', u || 'all');
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('unizy:uni', { detail: u }));
}

// live counts (modules, departments, marking criteria per university)
let statsP = null;
export function loadStats(url, key) {
  if (statsP) return statsP;
  statsP = fetch(url + '/rest/v1/rpc/public_uni_stats', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}' })
    .then((r) => (r.ok ? r.json() : null))
    .then((rows) => {
      (rows || []).forEach((r) => { if (UNIS[r.uni]) UNIS[r.uni].stats = { modules: r.modules, departments: r.departments, rubrics: r.rubrics }; });
      return true;
    })
    .catch(() => false);
  return statsP;
}

const n = (v) => Number(v).toLocaleString('en-GB');
const sum = (k) => UNI_IDS.reduce((t, id) => t + (+UNIS[id].stats[k] || 0), 0);

// Everything on the homepage that changes with the university. '' = all universities.
export function uniCopy(id) {
  const U = UNIS[id];
  if (!U) {
    const mods = sum('modules');
    return {
      id: '', all: true, short: 'your uni', name: 'UCL, Imperial, Queen Mary and LSE',
      kick: 'Every module · 4 universities', modulesLine: n(mods) + ' modules, 4 universities',
      more: '+' + n(mods - 3), tags: ['ECON0013', 'MATH40001', 'EC1A3'], book: UNIS.ucl.book, course: UNIS.ucl.course,
      bands: 'your university’s grade bands', corner: 'UCL · Imperial · Queen Mary · LSE',
      crit: 'Your department · Year 1 criteria', critShort: 'your department’s criteria', tutor: 'Your module professor', tutorH: 'A professor for<br>every module',
      gapAt: 'At uni', anyOf: 'any of ' + n(mods) + ' modules',
      numsH: 'Four universities. <span class="uz-serif">Every module.</span>',
      nums: [[mods, 'modules at UCL, Imperial, Queen Mary and LSE'], [sum('departments'), 'departments, schools and units'], [sum('rubrics'), 'sets of marking criteria across 4 universities'], [4, 'London universities, one dashboard']],
      backH: 'Every<br>module.', back: [['Modules', n(mods)], ['Universities', '4'], ['Criteria sets', n(sum('rubrics'))]],
      mods: ALL_MODS, mq: ['Marked like your department marks', 'Free 3-day trial', 'No card needed', 'UCL · Imperial · Queen Mary · LSE', 'A professor for every module'],
      pat: ['#F1DDA9', '#17302A'],
    };
  }
  const s = U.stats, dep = Math.max(0, s.rubrics - 1);
  return {
    id, all: false, short: U.short, name: U.name,
    kick: 'Every ' + U.short + ' module', modulesLine: n(s.modules) + ' ' + U.short + ' ' + U.modWord,
    more: '+' + n(s.modules - 3), tags: U.tags, book: U.book, course: U.course, bands: U.bands, corner: U.short + ' · <b>Exam practice</b>',
    crit: U.short + ' Economics · Year 1 criteria', critShort: U.short + ' Economics criteria', tutor: U.tutor, tutorH: U.tutor + ',<br>every module',
    gapAt: 'At ' + U.short, anyOf: 'any of ' + U.poss + ' ' + n(s.modules),
    numsH: 'Built for ' + U.short + '. <span class="uz-serif">All of it.</span>',
    nums: [[s.modules, U.short + ' ' + U.modWord + ', ' + U.src], [s.departments, U.short + ' ' + U.depts], [s.rubrics, 'sets of marking criteria (' + U.short + '-wide' + (dep ? ' + ' + dep + ' ' + (dep === 1 ? U.unit.replace(/s$/, '') : U.unit) : '') + ')'], [3, 'concrete changes on every marked answer']],
    backH: 'Every ' + U.short + '<br>module.', back: [['Modules', n(s.modules)], [U.unit[0].toUpperCase() + U.unit.slice(1), n(s.departments)], ['Criteria sets', n(s.rubrics)]],
    mods: U.mods, mq: ['Marked like your department marks', 'Free 3-day trial', 'No card needed', 'Every ' + U.short + ' module', U.tutor],
    pat: U.pat,
  };
}
