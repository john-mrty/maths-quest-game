// Maths question engine for Turbo Tables.
// Levels follow the Irish primary curriculum (1st to 6th class, ages 7 to 12).
// Each level defines number ranges per operation. Questions are weighted towards
// facts the player has recently got wrong, so practice targets weak spots.

export const LEVELS = [
  {
    id: 1, name: '1st class', age: 7,
    blurb: 'Adding and taking away up to 20',
    ops: ['add', 'sub'],
    add: { max: 20 }, sub: { max: 20 },
    mul: { tables: [2, 10], maxMult: 5 }, div: { tables: [2, 10], maxMult: 5 },
  },
  {
    id: 2, name: '2nd class', age: 8,
    blurb: 'Up to 100, and the 2, 5 and 10 times tables',
    ops: ['add', 'sub', 'mul'],
    add: { max: 100, tensFriendly: true }, sub: { max: 100, tensFriendly: true },
    mul: { tables: [2, 5, 10], maxMult: 10 }, div: { tables: [2, 5, 10], maxMult: 10 },
  },
  {
    id: 3, name: '3rd class', age: 9,
    blurb: 'Tables 2 to 6 and 10, with dividing',
    ops: ['add', 'sub', 'mul', 'div'],
    add: { max: 100 }, sub: { max: 100 },
    mul: { tables: [2, 3, 4, 5, 6, 10], maxMult: 10 }, div: { tables: [2, 3, 4, 5, 6, 10], maxMult: 10 },
  },
  {
    id: 4, name: '4th class', age: 10,
    blurb: 'All tables to 12, bigger sums',
    ops: ['add', 'sub', 'mul', 'div'],
    add: { max: 500 }, sub: { max: 500 },
    mul: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxMult: 12 },
    div: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxMult: 12 },
  },
  {
    id: 5, name: '5th class', age: 11,
    blurb: 'Fast tables to 12, two-digit multiplying',
    ops: ['add', 'sub', 'mul', 'div'],
    add: { max: 1000 }, sub: { max: 1000 },
    mul: { tables: [3, 4, 6, 7, 8, 9, 11, 12], maxMult: 12, twoDigit: true },
    div: { tables: [3, 4, 6, 7, 8, 9, 11, 12], maxMult: 12 },
  },
  {
    id: 6, name: '6th class', age: 12,
    blurb: 'Tricky tables, squares and big numbers',
    ops: ['add', 'sub', 'mul', 'div'],
    add: { max: 2000 }, sub: { max: 2000 },
    mul: { tables: [6, 7, 8, 9, 11, 12, 13, 15], maxMult: 12, twoDigit: true },
    div: { tables: [6, 7, 8, 9, 11, 12, 13, 15], maxMult: 12 },
  },
];

export const OP_LABELS = { add: 'Adding', sub: 'Taking away', mul: 'Times tables', div: 'Dividing' };
export const OP_SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷' };

const rand = (n) => Math.floor(Math.random() * n);
const randBetween = (a, b) => a + rand(b - a + 1);
const pick = (arr) => arr[rand(arr.length)];
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = rand(i + 1);[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

// Progress memory: a score per fact key. Positive = known, negative = needs work.
export class Progress {
  constructor(storageKey, initial=null, onSave=null) {
    this.key = storageKey;
    this.facts = {};
    this.history = [];
    this.onSave=onSave;
    if(initial){this.facts=initial.facts||{};this.history=initial.history||[];}else this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) { const d = JSON.parse(raw); this.facts = d.facts || {}; this.history = d.history || []; }
    } catch (e) { /* storage unavailable: play without memory */ }
  }
  save() {
    if(this.onSave){this.onSave({facts:this.facts,history:this.history.slice(-40)});return;}
    try { localStorage.setItem(this.key, JSON.stringify({ facts: this.facts, history: this.history.slice(-40) })); } catch (e) { /* ignore */ }
  }
  record(q, correct) {
    const f = this.facts[q.key] || { score: 0, seen: 0, wrong: 0 };
    f.seen++;
    if (correct) f.score = Math.min(5, f.score + 1); else { f.score = Math.max(-5, f.score - 2); f.wrong++; }
    f.last = Date.now();
    this.facts[q.key] = f;
    this.save();
  }
  weakFacts(limit = 6) {
    return Object.entries(this.facts)
      .filter(([, f]) => f.score < 1 && f.wrong > 0)
      .sort((a, b) => a[1].score - b[1].score)
      .slice(0, limit)
      .map(([key]) => key);
  }
  weight(key) {
    const f = this.facts[key];
    if (!f) return 1.6;           // unseen facts are interesting
    if (f.score <= -2) return 4;  // keep coming back to weak facts
    if (f.score <= 0) return 2.5;
    if (f.score >= 4) return 0.5; // mastered: show less often
    return 1;
  }
}

// Build a candidate question for one operation at a level.
function makeCandidate(level, op) {
  let a, b, answer, text, key;
  if (op === 'add') {
    const max = level.add.max;
    if (level.add.tensFriendly && Math.random() < 0.5) {
      a = randBetween(1, 9) * 10; b = randBetween(1, 9);
      if (Math.random() < 0.5) [a, b] = [b, a];
    } else if (max <= 20) {
      a = randBetween(1, max - 1); b = randBetween(1, max - a);
    } else {
      // keep mental-friendly: at least one number fairly small or round
      a = randBetween(2, max - 2);
      const small = Math.random() < 0.6;
      b = small ? randBetween(max >= 500 ? 6 : 2, Math.min(12, max - a)) : randBetween(5, Math.min(max - a, Math.max(10, Math.floor(max / 4))));
      if (max >= 500 && Math.random() < 0.5) { a = Math.round(a / 10) * 10 || 10; b = Math.round(b / 10) * 10 || 10; }
    }
    answer = a + b; text = `${a} + ${b}`; key = `${a}+${b}`;
  } else if (op === 'sub') {
    const max = level.sub.max;
    if (level.sub.tensFriendly && Math.random() < 0.5) {
      b = randBetween(1, 9); a = randBetween(2, 9) * 10 + b; // e.g. 46 - 6
    } else if (max <= 20) {
      a = randBetween(2, max); b = randBetween(1, a - 1);
    } else {
      a = randBetween(10, max);
      const small = Math.random() < 0.6;
      b = small ? randBetween(max >= 500 ? 6 : 2, Math.min(12, a - 1)) : randBetween(5, Math.min(a - 1, Math.max(10, Math.floor(max / 4))));
      if (max >= 500 && Math.random() < 0.5) { a = Math.round(a / 10) * 10 || 20; b = Math.min(a - 10, Math.round(b / 10) * 10 || 10); }
    }
    answer = a - b; text = `${a} − ${b}`; key = `${a}-${b}`;
  } else if (op === 'mul') {
    const t = pick(level.mul.tables);
    if (level.mul.twoDigit && Math.random() < 0.3) {
      a = randBetween(13, 25); b = randBetween(3, 9);
    } else {
      a = t; b = randBetween(level.id >= 3 ? 2 : 1, level.mul.maxMult);
      if (Math.random() < 0.5) [a, b] = [b, a];
    }
    answer = a * b; text = `${a} × ${b}`; key = `${Math.min(a, b)}x${Math.max(a, b)}`;
  } else {
    const t = pick(level.div.tables);
    b = t; const q = randBetween(level.id >= 3 ? 2 : 1, level.div.maxMult); a = b * q;
    answer = q; text = `${a} ÷ ${b}`; key = `${a}/${b}`;
  }
  return { op, a, b, answer, text, key };
}

// Plausible wrong answers: near misses a child would actually make.
function distractors(q) {
  const set = new Set();
  const { answer, op, a, b } = q;
  const add = (v) => { if (Number.isInteger(v) && v >= 0 && v !== answer) set.add(v); };
  if (op === 'mul') {
    add(a * (b + 1)); add(a * (b - 1)); add((a + 1) * b); add((a - 1) * b);
    add(answer + 10); add(answer - 10); add(a + b);
  } else if (op === 'div') {
    add(answer + 1); add(answer - 1); add(answer + 2); add(answer - 2); add(b);
  } else {
    add(answer + 1); add(answer - 1); add(answer + 10); add(answer - 10); add(answer + 2); add(answer - 2);
    if (op === 'sub') add(a + b); else add(Math.abs(a - b));
  }
  add(answer + 3); add(answer - 3); add(answer + 20);
  return shuffle([...set]).slice(0, 2);
}

export class QuestionBank {
  constructor(level, ops, progress) {
    this.level = level;
    this.ops = ops.filter((o) => level.ops.includes(o));
    if (!this.ops.length) this.ops = [level.ops[0]];
    this.progress = progress;
    this.recent = [];
  }
  next() {
    // Sample several candidates, prefer weak or unseen facts.
    let best = null, bestScore = -1;
    for (let i = 0; i < 6; i++) {
      const c = makeCandidate(this.level, pick(this.ops));
      if (this.recent.includes(c.key)) continue;
      const w = this.progress.weight(c.key) * (0.6 + Math.random());
      if (w > bestScore) { bestScore = w; best = c; }
    }
    if (!best) best = makeCandidate(this.level, pick(this.ops));
    this.recent.push(best.key); if (this.recent.length > 8) this.recent.shift();
    const wrong = distractors(best);
    while (wrong.length < 2) wrong.push(best.answer + wrong.length + 4);
    const options = shuffle([best.answer, ...wrong]);
    return { ...best, options, correctIndex: options.indexOf(best.answer) };
  }
}

export function describeFact(key) {
  if (key.includes('x')) { const [a, b] = key.split('x'); return `${a} × ${b} = ${a * b}`; }
  if (key.includes('/')) { const [a, b] = key.split('/'); return `${a} ÷ ${b} = ${a / b}`; }
  if (key.includes('+')) { const [a, b] = key.split('+'); return `${a} + ${b} = ${+a + +b}`; }
  if (key.includes('-')) { const [a, b] = key.split('-'); return `${a} − ${b} = ${a - b}`; }
  return key;
}
