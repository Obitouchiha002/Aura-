/**
 * Reasoning assessment.
 *
 * The previous version asked the model to invent a score, which meant the
 * number changed if you asked twice and measured nothing. This replaces it
 * with a fixed item bank of known difficulty and deterministic scoring: the
 * same answers always produce the same result, and every point is traceable
 * to a specific question.
 *
 * Honest limits — worth repeating in the UI: a clinical IQ is standardised
 * against a population sample under supervised conditions. This is a
 * self-administered reasoning test. The 100-mean scale makes the result
 * readable, but it is an estimate from these items, not a clinical score.
 */

export type Domain = 'series' | 'analogy' | 'logic' | 'pattern' | 'numeric';

export interface Item {
  id: string;
  domain: Domain;
  /** 1 easy · 2 medium · 3 hard — drives both sampling and weighting. */
  difficulty: 1 | 2 | 3;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  series: 'Sequences',
  analogy: 'Verbal reasoning',
  logic: 'Logical deduction',
  pattern: 'Pattern recognition',
  numeric: 'Numerical reasoning',
};

/** Seconds allowed per item, by difficulty. */
export const TIME_LIMIT: Record<1 | 2 | 3, number> = { 1: 40, 2: 55, 3: 75 };

export const ITEM_BANK: Item[] = [
  // ── sequences ───────────────────────────────────────────────────────────
  { id: 's1', domain: 'series', difficulty: 1,
    question: 'What comes next?  2, 4, 8, 16, __',
    options: ['20', '24', '32', '30'], answer: 2,
    explanation: 'Each term doubles. 16 × 2 = 32.' },
  { id: 's2', domain: 'series', difficulty: 1,
    question: 'What comes next?  1, 4, 9, 16, __',
    options: ['20', '25', '24', '36'], answer: 1,
    explanation: 'Square numbers: 1², 2², 3², 4², so 5² = 25.' },
  { id: 's3', domain: 'series', difficulty: 2,
    question: 'What comes next?  3, 6, 11, 18, 27, __',
    options: ['36', '38', '40', '35'], answer: 1,
    explanation: 'Gaps grow by 2 each time: +3, +5, +7, +9, +11. 27 + 11 = 38.' },
  { id: 's4', domain: 'series', difficulty: 2,
    question: 'What comes next?  A, C, F, J, __',
    options: ['M', 'N', 'O', 'P'], answer: 2,
    explanation: 'Skips grow: +2, +3, +4, then +5. J + 5 = O.' },
  { id: 's5', domain: 'series', difficulty: 3,
    question: 'What comes next?  1, 1, 2, 3, 5, 8, 13, __',
    options: ['18', '20', '21', '24'], answer: 2,
    explanation: 'Fibonacci — each term is the sum of the two before it. 8 + 13 = 21.' },
  { id: 's6', domain: 'series', difficulty: 3,
    question: 'What comes next?  2, 3, 5, 9, 17, __',
    options: ['33', '31', '29', '34'], answer: 0,
    explanation: 'Each step doubles the gap: +1, +2, +4, +8, +16. 17 + 16 = 33.' },
  { id: 's7', domain: 'series', difficulty: 2,
    question: 'What comes next?  100, 96, 88, 72, __',
    options: ['48', '40', '56', '64'], answer: 1,
    explanation: 'Subtract 4, 8, 16, then 32. 72 − 32 = 40.' },
  { id: 's8', domain: 'series', difficulty: 3,
    question: 'What comes next?  7, 14, 12, 24, 22, __',
    options: ['44', '20', '11', '46'], answer: 0,
    explanation: 'Alternating: double, then subtract 2. 22 × 2 = 44.' },

  // ── verbal reasoning ────────────────────────────────────────────────────
  { id: 'a1', domain: 'analogy', difficulty: 1,
    question: 'Hand is to Glove as Foot is to __',
    options: ['Leg', 'Shoe', 'Toe', 'Walk'], answer: 1,
    explanation: 'A glove covers a hand; a shoe covers a foot.' },
  { id: 'a2', domain: 'analogy', difficulty: 1,
    question: 'Doctor is to Hospital as Teacher is to __',
    options: ['Student', 'Book', 'School', 'Lesson'], answer: 2,
    explanation: 'The relationship is person to workplace.' },
  { id: 'a3', domain: 'analogy', difficulty: 2,
    question: 'Thirsty is to Drink as Tired is to __',
    options: ['Sleep', 'Work', 'Weak', 'Yawn'], answer: 0,
    explanation: 'A need paired with the action that resolves it. A yawn is a symptom, not the remedy.' },
  { id: 'a4', domain: 'analogy', difficulty: 2,
    question: 'Careful is to Cautious as Frugal is to __',
    options: ['Rich', 'Wasteful', 'Thrifty', 'Poor'], answer: 2,
    explanation: 'Both pairs are synonyms. Frugal and thrifty both mean sparing with money.' },
  { id: 'a5', domain: 'analogy', difficulty: 3,
    question: 'Sculptor is to Statue as Author is to __',
    options: ['Pen', 'Reader', 'Novel', 'Library'], answer: 2,
    explanation: 'Maker to the thing made. A pen is the tool, not the product.' },
  { id: 'a6', domain: 'analogy', difficulty: 3,
    question: 'Whisper is to Shout as Drizzle is to __',
    options: ['Rain', 'Cloud', 'Downpour', 'Wet'], answer: 2,
    explanation: 'Both pairs run from a mild form to an intense one.' },
  { id: 'a7', domain: 'analogy', difficulty: 2,
    question: 'Odometer is to Distance as Scale is to __',
    options: ['Weight', 'Balance', 'Metal', 'Kitchen'], answer: 0,
    explanation: 'Instrument to the quantity it measures.' },

  // ── logical deduction ───────────────────────────────────────────────────
  { id: 'l1', domain: 'logic', difficulty: 1,
    question: 'All roses are flowers. Some flowers fade quickly. Therefore:',
    options: [
      'All roses fade quickly',
      'Some roses fade quickly',
      'No roses fade quickly',
      'None of these follows necessarily',
    ], answer: 3,
    explanation: 'The flowers that fade may all be non-roses. Nothing about roses follows for certain.' },
  { id: 'l2', domain: 'logic', difficulty: 2,
    question: 'If it rains, the match is cancelled. The match was not cancelled. Therefore:',
    options: ['It rained', 'It did not rain', 'It may have rained', 'The match was postponed'], answer: 1,
    explanation: 'Denying the consequent. If rain guarantees cancellation, no cancellation means no rain.' },
  { id: 'l3', domain: 'logic', difficulty: 2,
    question: 'Every student who passed studied. Ravi studied. Therefore:',
    options: ['Ravi passed', 'Ravi did not pass', 'Ravi may or may not have passed', 'Ravi failed'], answer: 2,
    explanation: 'Studying is necessary for passing, not sufficient. The conclusion does not follow.' },
  { id: 'l4', domain: 'logic', difficulty: 3,
    question: 'A is taller than B. C is shorter than B. D is taller than A. Who is shortest?',
    options: ['A', 'B', 'C', 'D'], answer: 2,
    explanation: 'Order is D > A > B > C, so C is shortest.' },
  { id: 'l5', domain: 'logic', difficulty: 3,
    question: 'Only one of these is true. (1) All are lying. (2) Exactly one is lying. (3) Two are lying. Which is true?',
    options: ['Statement 1', 'Statement 2', 'Statement 3', 'Cannot be determined'], answer: 2,
    explanation: 'If 3 is true, then 1 and 2 are false — exactly two liars, which is consistent. The others contradict themselves.' },
  { id: 'l6', domain: 'logic', difficulty: 2,
    question: 'No cheap phone is durable. Some durable things are expensive. Therefore:',
    options: [
      'All expensive things are durable',
      'Some cheap phones are durable',
      'No cheap phone is in the set of durable things',
      'All durable things are expensive',
    ], answer: 2,
    explanation: 'Only the first premise can be restated. The rest overreach.' },

  // ── pattern recognition ─────────────────────────────────────────────────
  { id: 'p1', domain: 'pattern', difficulty: 1,
    question: 'Which one does not belong?  Square, Triangle, Circle, Cube',
    options: ['Square', 'Triangle', 'Circle', 'Cube'], answer: 3,
    explanation: 'A cube is three-dimensional; the rest are flat shapes.' },
  { id: 'p2', domain: 'pattern', difficulty: 2,
    question: 'Which one does not belong?  16, 25, 36, 45, 49',
    options: ['16', '36', '45', '49'], answer: 2,
    explanation: '45 is not a perfect square.' },
  { id: 'p3', domain: 'pattern', difficulty: 2,
    question: 'If ▲▲■ becomes ■▲▲, then ●●◆ becomes:',
    options: ['◆●●', '●◆●', '●●◆', '◆◆●'], answer: 0,
    explanation: 'The last symbol moves to the front.' },
  { id: 'p4', domain: 'pattern', difficulty: 3,
    question: 'A grid reads: 2 3 5 / 4 6 10 / 6 9 __',
    options: ['12', '15', '14', '18'], answer: 1,
    explanation: 'Each row is the first row multiplied by 1, 2, 3. Row three is 2×3, 3×3, 5×3 = 6, 9, 15.' },
  { id: 'p5', domain: 'pattern', difficulty: 3,
    question: 'CODE is written as DPEF. How is MIND written?',
    options: ['NJOE', 'NJOF', 'LHMC', 'NKOE'], answer: 0,
    explanation: 'Each letter shifts forward by one. M→N, I→J, N→O, D→E.' },
  { id: 'p6', domain: 'pattern', difficulty: 1,
    question: 'Which one does not belong?  Cat, Dog, Lion, Sparrow',
    options: ['Cat', 'Dog', 'Lion', 'Sparrow'], answer: 3,
    explanation: 'A sparrow is a bird; the rest are mammals.' },

  // ── numerical reasoning ─────────────────────────────────────────────────
  { id: 'n1', domain: 'numeric', difficulty: 1,
    question: 'A shirt costs 800 after a 20% discount. What was the original price?',
    options: ['960', '1000', '1020', '1600'], answer: 1,
    explanation: '800 is 80% of the original. 800 ÷ 0.8 = 1000.' },
  { id: 'n2', domain: 'numeric', difficulty: 2,
    question: 'If 5 machines make 5 items in 5 minutes, how long do 100 machines take to make 100 items?',
    options: ['100 minutes', '20 minutes', '5 minutes', '1 minute'], answer: 2,
    explanation: 'Each machine takes 5 minutes per item. More machines work in parallel, so it stays 5 minutes.' },
  { id: 'n3', domain: 'numeric', difficulty: 2,
    question: 'A bat and a ball cost 1100 together. The bat costs 1000 more than the ball. What does the ball cost?',
    options: ['100', '50', '10', '110'], answer: 1,
    explanation: 'Ball 50, bat 1050. The difference is 1000 and the total is 1100.' },
  { id: 'n4', domain: 'numeric', difficulty: 3,
    question: 'A lily patch doubles each day and covers the lake on day 48. On which day is it half covered?',
    options: ['Day 24', 'Day 47', 'Day 46', 'Day 12'], answer: 1,
    explanation: 'Doubling backwards once from full gives half, so day 47.' },
  { id: 'n5', domain: 'numeric', difficulty: 3,
    question: 'You buy at 60, sell at 70, buy back at 80, sell at 90. What is the total profit?',
    options: ['10', '20', '30', '0'], answer: 1,
    explanation: 'Two separate trades: +10 and +10. Total 20.' },
  { id: 'n6', domain: 'numeric', difficulty: 2,
    question: 'The average of five numbers is 20. One number is removed and the average becomes 22. Which was removed?',
    options: ['12', '18', '20', '14'], answer: 0,
    explanation: 'Total was 100; four numbers now total 88. The removed number is 12.' },
];

/* ── session assembly ────────────────────────────────────────────────────── */

export interface TestItem extends Item {
  /** Options are shuffled per session, so the answer index moves with them. */
  shuffled: string[];
  correctIndex: number;
}

export interface Answer {
  itemId: string;
  chosen: number | null;   // null = ran out of time
  correct: boolean;
  seconds: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const QUESTIONS_PER_TEST = 15;

/**
 * Builds one sitting: a fresh, balanced sample. Every domain appears, and the
 * mix of difficulties is held steady so two sessions stay comparable.
 */
export function buildTest(): TestItem[] {
  const domains: Domain[] = ['series', 'analogy', 'logic', 'pattern', 'numeric'];
  const picked: Item[] = [];

  // Three per domain, spread across difficulty where the bank allows.
  for (const d of domains) {
    const pool = ITEM_BANK.filter(i => i.domain === d);
    for (const diff of [1, 2, 3] as const) {
      const tier = shuffle(pool.filter(i => i.difficulty === diff && !picked.includes(i)));
      if (tier[0]) picked.push(tier[0]);
    }
  }

  // Top up from whatever is left if a tier was empty.
  const rest = shuffle(ITEM_BANK.filter(i => !picked.includes(i)));
  while (picked.length < QUESTIONS_PER_TEST && rest.length) picked.push(rest.shift()!);

  return shuffle(picked).slice(0, QUESTIONS_PER_TEST).map(item => {
    const order = shuffle(item.options.map((text, i) => ({ text, i })));
    return {
      ...item,
      shuffled: order.map(o => o.text),
      correctIndex: order.findIndex(o => o.i === item.answer),
    };
  });
}

/* ── scoring ─────────────────────────────────────────────────────────────── */

export interface DomainScore {
  domain: Domain;
  correct: number;
  total: number;
  percent: number;
}

export interface Report {
  /** Weighted accuracy, 0–100. */
  accuracy: number;
  /** Readable 55–145 estimate, mean 100. NOT a clinical IQ. */
  index: number;
  band: string;
  correct: number;
  total: number;
  /** Median seconds per answered question. */
  medianSeconds: number;
  domains: DomainScore[];
  strongest: Domain | null;
  weakest: Domain | null;
  missed: { item: Item; chosen: string | null }[];
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function bandFor(index: number): string {
  if (index >= 130) return 'Very high';
  if (index >= 120) return 'High';
  if (index >= 110) return 'Above average';
  if (index >= 90) return 'Average';
  if (index >= 80) return 'Below average';
  return 'Low';
}

/**
 * Deterministic. Harder items are worth more, and a modest speed factor
 * rewards answering well inside the limit — but it can only move the result a
 * few points, because accuracy is what is being measured.
 */
export function scoreTest(items: TestItem[], answers: Answer[]): Report {
  const byId = new Map(items.map(i => [i.id, i]));

  let earned = 0;
  let possible = 0;
  const perDomain = new Map<Domain, { correct: number; total: number }>();
  const missed: Report['missed'] = [];
  const times: number[] = [];

  for (const a of answers) {
    const item = byId.get(a.itemId);
    if (!item) continue;

    possible += item.difficulty;
    if (a.correct) earned += item.difficulty;
    if (a.chosen !== null) times.push(a.seconds);

    const d = perDomain.get(item.domain) ?? { correct: 0, total: 0 };
    d.total += 1;
    if (a.correct) d.correct += 1;
    perDomain.set(item.domain, d);

    if (!a.correct) {
      missed.push({
        item,
        chosen: a.chosen === null ? null : item.shuffled[a.chosen] ?? null,
      });
    }
  }

  const accuracy = possible ? (earned / possible) * 100 : 0;

  // Speed: at or under half the average limit is the ceiling, at the limit is
  // the floor. Range is deliberately narrow (±4).
  const avgLimit = items.length
    ? items.reduce((s, i) => s + TIME_LIMIT[i.difficulty], 0) / items.length
    : 60;
  const med = median(times);
  const speedRatio = med > 0 ? Math.min(1, Math.max(0, (avgLimit - med) / (avgLimit / 2))) : 0;
  const speedBonus = (speedRatio - 0.5) * 8;

  const index = Math.round(
    Math.min(145, Math.max(55, 55 + (accuracy / 100) * 85 + speedBonus))
  );

  const domains: DomainScore[] = [...perDomain.entries()]
    .map(([domain, v]) => ({
      domain,
      correct: v.correct,
      total: v.total,
      percent: v.total ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent);

  return {
    accuracy: Math.round(accuracy),
    index,
    band: bandFor(index),
    correct: answers.filter(a => a.correct).length,
    total: answers.length,
    medianSeconds: med,
    domains,
    strongest: domains[0]?.domain ?? null,
    weakest: domains[domains.length - 1]?.domain ?? null,
    missed,
  };
}
