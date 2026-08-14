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

export type Domain = 'series' | 'analogy' | 'logic' | 'pattern' | 'numeric' | 'case';

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
  case: 'Case reasoning',
};

/** Seconds allowed per item, by difficulty. */
export const TIME_LIMIT: Record<1 | 2 | 3, number> = { 1: 40, 2: 55, 3: 75 };

export const ITEM_BANK: Item[] = [
  // ── sequences ───────────────────────────────────────────────────────────
  { id: 's1', domain: 'series', difficulty: 1,
    question: '0, 1, 1, 2, 3, 5, 8, __',
    options: ['11', '13', '12', '10'], answer: 1,
    explanation: 'Each term is the sum of the two before it. 5 + 8 = 13.' },
  { id: 's2', domain: 'series', difficulty: 1,
    question: '2, 6, 12, 20, 30, __',
    options: ['40', '42', '44', '38'], answer: 1,
    explanation: 'The gaps grow by two each time: 4, 6, 8, 10, then 12. 30 + 12 = 42.' },
  { id: 's3', domain: 'series', difficulty: 2,
    question: '1, 2, 6, 24, 120, __',
    options: ['600', '720', '540', '840'], answer: 1,
    explanation: 'Each term is multiplied by the next whole number. 120 × 6 = 720.' },
  { id: 's4', domain: 'series', difficulty: 2,
    question: '7, 10, 8, 11, 9, 12, __',
    options: ['10', '13', '8', '14'], answer: 0,
    explanation: 'Two steps alternate: add 3, subtract 2. After 12 comes 12 - 2 = 10.' },
  { id: 's5', domain: 'series', difficulty: 2,
    question: '4, 9, 25, 49, 121, __',
    options: ['144', '169', '153', '165'], answer: 1,
    explanation: 'Squares of the primes 2, 3, 5, 7, 11. Next is 13² = 169.' },
  { id: 's6', domain: 'series', difficulty: 3,
    question: '2, 3, 5, 9, 17, __',
    options: ['31', '33', '34', '29'], answer: 1,
    explanation: 'The gaps double: 1, 2, 4, 8, then 16. 17 + 16 = 33.' },
  { id: 's7', domain: 'series', difficulty: 3,
    question: '1, 11, 21, 1211, 111221, __',
    options: ['312211', '311221', '212211', '131221'], answer: 0,
    explanation: 'Each line describes the one above it aloud. 111221 reads as three 1s, two 2s, one 1 — 312211.' },
  { id: 's8', domain: 'series', difficulty: 3,
    question: '3, 7, 15, 31, __',
    options: ['47', '63', '62', '55'], answer: 1,
    explanation: 'Each term doubles and adds one. 31 × 2 + 1 = 63.' },

  // ── verbal reasoning ────────────────────────────────────────────────────
  { id: 'a1', domain: 'analogy', difficulty: 1,
    question: 'Oasis is to Desert as ___ is to Ocean.',
    options: ['Island', 'Wave', 'Ship', 'Reef'], answer: 0,
    explanation: 'An oasis is dry land surrounded by desert; an island is dry land surrounded by ocean.' },
  { id: 'a2', domain: 'analogy', difficulty: 1,
    question: 'Thermometer is to Temperature as Barometer is to ___.',
    options: ['Pressure', 'Altitude', 'Humidity', 'Wind'], answer: 0,
    explanation: 'Each instrument measures the quantity named.' },
  { id: 'a3', domain: 'analogy', difficulty: 2,
    question: 'Chapter is to Novel as ___ is to Symphony.',
    options: ['Movement', 'Note', 'Orchestra', 'Conductor'], answer: 0,
    explanation: 'A movement is a titled section of a symphony, as a chapter is of a novel.' },
  { id: 'a4', domain: 'analogy', difficulty: 2,
    question: 'Drought is to Rain as Famine is to ___.',
    options: ['Food', 'Hunger', 'Water', 'Crops'], answer: 0,
    explanation: 'Each names a shortage and the thing that is short.' },
  { id: 'a5', domain: 'analogy', difficulty: 2,
    question: 'Ephemeral is to Permanent as Sporadic is to ___.',
    options: ['Constant', 'Frequent', 'Random', 'Brief'], answer: 0,
    explanation: 'Both pairs are opposites. Sporadic means occasional and irregular; its opposite is constant. Frequent is a trap — it is a matter of degree, not the reverse.' },
  { id: 'a6', domain: 'analogy', difficulty: 3,
    question: 'Frugal is to Miserly as Confident is to ___.',
    options: ['Arrogant', 'Timid', 'Certain', 'Capable'], answer: 0,
    explanation: 'Each pair runs from a virtue to its excess. Frugal taken too far is miserly; confident taken too far is arrogant.' },
  { id: 'a7', domain: 'analogy', difficulty: 3,
    question: 'Cartographer is to Map as Lexicographer is to ___.',
    options: ['Dictionary', 'Library', 'Grammar', 'Novel'], answer: 0,
    explanation: 'Each names the specialist and the work they compile.' },

  // ── logical deduction ───────────────────────────────────────────────────
  { id: 'l1', domain: 'logic', difficulty: 1,
    question: 'Every manager is an engineer. Some engineers are designers. No designer is a manager. Which must be true?',
    options: ['Some engineers are not managers', 'All engineers are managers', 'Some managers are designers', 'No engineer is a designer'], answer: 0,
    explanation: 'At least one engineer is a designer, and no designer is a manager — so at least one engineer is not a manager.' },
  { id: 'l2', domain: 'logic', difficulty: 2,
    question: 'Every student who passed the exam had studied. Ravi studied. What follows?',
    options: ['Nothing certain about Ravi', 'Ravi passed', 'Ravi failed', 'Ravi was not a student'], answer: 0,
    explanation: 'Studying was necessary to pass, not sufficient. Ravi meets the requirement but that does not settle the result.' },
  { id: 'l3', domain: 'logic', difficulty: 2,
    question: 'Two people. A says: "We are both liars." Liars always lie and truth-tellers always tell the truth. What are they?',
    options: ['A lies, B tells the truth', 'Both lie', 'A tells the truth, B lies', 'Both tell the truth'], answer: 0,
    explanation: 'If A were truthful the claim would make A a liar — impossible. So A lies, which makes "both are liars" false, so B tells the truth.' },
  { id: 'l4', domain: 'logic', difficulty: 2,
    question: 'In a race you overtake the runner in second place. What position are you in?',
    options: ['Second', 'First', 'Third', 'Cannot be known'], answer: 0,
    explanation: 'You take the overtaken runner\'s place. Passing second puts you second, not first.' },
  { id: 'l5', domain: 'logic', difficulty: 3,
    question: 'Three boxes are labelled Apples, Oranges and Mixed. Every label is wrong. Drawing one fruit from one box, which box tells you all three?',
    options: ['The one labelled Mixed', 'The one labelled Apples', 'The one labelled Oranges', 'Any box works'], answer: 0,
    explanation: 'That box cannot be mixed, so one fruit reveals it completely — and since every label is wrong, the other two then follow.' },
  { id: 'l6', domain: 'logic', difficulty: 3,
    question: 'Four people cross a bridge at night with one torch. Two may cross at a time and the torch must be carried back. They need 1, 2, 5 and 10 minutes; a pair moves at the slower speed. What is the minimum total time?',
    options: ['17 minutes', '19 minutes', '21 minutes', '25 minutes'], answer: 0,
    explanation: 'Send 1 and 2 (2), return 1 (1), send 5 and 10 together (10), return 2 (2), send 1 and 2 (2). Total 17. The trick is pairing the two slowest so their times overlap.' },
  { id: 'l7', domain: 'logic', difficulty: 3,
    question: 'A shop alarm sounded at 2:00am. Only Asha, Bilal and Chandni hold keys. Asha was on a flight that landed at 3:00am. Bilal\'s key was sealed in an envelope at his lawyer\'s office all week. A neighbour saw Chandni at home at 1:55am. Who could still have opened the shop?',
    options: ['Chandni', 'Asha', 'Bilal', 'Nobody'], answer: 0,
    explanation: 'Asha was airborne and Bilal had no key to use. Chandni was only placed at home at 1:55 — that says nothing about 2:00.' },

  // ── pattern recognition ─────────────────────────────────────────────────
  { id: 'p1', domain: 'pattern', difficulty: 1,
    question: 'Which one does not belong?  16, 25, 36, 45, 49',
    options: ['16', '36', '45', '49'], answer: 2,
    explanation: '45 is not a perfect square.' },
  { id: 'p2', domain: 'pattern', difficulty: 1,
    question: 'CODE is written as DPEF. How is MIND written?',
    options: ['NJOE', 'NJOF', 'LHMC', 'NKOE'], answer: 0,
    explanation: 'Every letter moves forward by one. M→N, I→J, N→O, D→E.' },
  { id: 'p3', domain: 'pattern', difficulty: 2,
    question: 'A grid reads:  2 3 5 / 4 6 10 / 6 9 __',
    options: ['12', '15', '14', '18'], answer: 1,
    explanation: 'Each row is the first row times 1, 2 and 3. The third row is 2×3, 3×3, 5×3 — so 15.' },
  { id: 'p4', domain: 'pattern', difficulty: 2,
    question: 'A 3×3 magic square is filled with 1 to 9 so every row, column and diagonal sums to the same total. What must the centre number be?',
    options: ['5', '3', '7', '9'], answer: 0,
    explanation: 'The three lines through the centre sum to 45 plus twice the centre, and must equal 3 × 15. That forces the centre to 5.' },
  { id: 'p5', domain: 'pattern', difficulty: 3,
    question: 'If FLOWER is coded GKPVFQ, how is GARDEN coded?',
    options: ['HZSCFM', 'HBSEFO', 'FZQCDM', 'HZSCFO'], answer: 0,
    explanation: 'Letters shift alternately forward one and back one. G→H, A→Z, R→S, D→C, E→F, N→M.' },
  { id: 'p6', domain: 'pattern', difficulty: 3,
    question: 'A cube is painted red on every face, then cut into 27 equal smaller cubes. How many have exactly two red faces?',
    options: ['12', '8', '6', '24'], answer: 0,
    explanation: 'Two painted faces means an edge position that is not a corner. A cube has 12 edges with one such cube each.' },

  // ── numerical reasoning ─────────────────────────────────────────────────
  { id: 'n1', domain: 'numeric', difficulty: 1,
    question: 'A shirt costs 800 after a 20% discount. What was the original price?',
    options: ['960', '1000', '1020', '1600'], answer: 1,
    explanation: '800 is 80% of the original. 800 ÷ 0.8 = 1000.' },
  { id: 'n2', domain: 'numeric', difficulty: 2,
    question: 'A bat and a ball cost 1100 together. The bat costs 1000 more than the ball. What does the ball cost?',
    options: ['50', '100', '110', '150'], answer: 0,
    explanation: 'If the ball were 100 the bat would be 1100 and the pair 1200. Ball 50, bat 1050 — a difference of 1000 and a total of 1100.' },
  { id: 'n3', domain: 'numeric', difficulty: 2,
    question: 'If 5 machines make 5 items in 5 minutes, how long do 100 machines take to make 100 items?',
    options: ['5 minutes', '20 minutes', '100 minutes', '1 minute'], answer: 0,
    explanation: 'Each machine takes 5 minutes per item. Adding machines adds parallel work, not speed, so it stays 5 minutes.' },
  { id: 'n4', domain: 'numeric', difficulty: 2,
    question: 'Of 30 people, 18 drink tea, 15 drink coffee and 6 drink neither. How many drink both?',
    options: ['9', '3', '6', '12'], answer: 0,
    explanation: '24 drink at least one. 18 + 15 = 33 counts the overlap twice, so both = 33 - 24 = 9.' },
  { id: 'n5', domain: 'numeric', difficulty: 3,
    question: 'A patch of lily pads doubles every day and covers the whole lake on day 48. On which day is the lake half covered?',
    options: ['Day 47', 'Day 24', 'Day 46', 'Day 12'], answer: 0,
    explanation: 'It doubles daily, so the day before full cover it was half. Halving the number of days is the trap.' },
  { id: 'n6', domain: 'numeric', difficulty: 3,
    question: 'A car covers 60 km at 30 km/h and returns the same 60 km at 60 km/h. What is the average speed for the round trip?',
    options: ['40 km/h', '45 km/h', '50 km/h', '48 km/h'], answer: 0,
    explanation: 'The trip takes 2 hours out and 1 back — 120 km in 3 hours, so 40 km/h. Averaging the two speeds to 45 ignores the longer time spent going slowly.' },

  // ── case reasoning ──────────────────────────────────────────────────────
  { id: 'c1', domain: 'case', difficulty: 1,
    question: 'A stationery shop sells 3 pens for 36. At the same rate, what do 7 pens cost?',
    options: ['84', '72', '96', '108'], answer: 0,
    explanation: 'One pen costs 12, so seven cost 84.' },
  { id: 'c2', domain: 'case', difficulty: 2,
    question: 'A courier charges 40 for the first kilogram and 12 for every additional kilogram. A customer was billed 100. What did the parcel weigh?',
    options: ['6 kg', '5 kg', '7 kg', '8 kg'], answer: 0,
    explanation: '100 - 40 = 60 for the extra weight, and 60 ÷ 12 = 5 extra kilograms. With the first kilogram that is 6 kg.' },
  { id: 'c3', domain: 'case', difficulty: 2,
    question: 'A trader buys an item for 500, marks it up 20%, then runs a sale at 20% off the marked price. What is the result?',
    options: ['A loss of 20', 'Breaks even', 'A profit of 20', 'A profit of 100'], answer: 0,
    explanation: 'Marked at 600, sold at 480. The two 20% figures apply to different amounts, so they do not cancel.' },
  { id: 'c4', domain: 'case', difficulty: 2,
    question: 'A survey of 200 people found 120 own a bicycle and 90 own a car, with 40 owning both. How many own neither?',
    options: ['30', '20', '40', '10'], answer: 0,
    explanation: '120 + 90 - 40 = 170 own at least one, leaving 30.' },
  { id: 'c5', domain: 'case', difficulty: 2,
    question: 'Four workers can finish a job in 12 days. After 3 days two of them leave. How many more days will the remaining two need?',
    options: ['18', '12', '24', '9'], answer: 0,
    explanation: 'The job is 48 worker-days. 3 days of four workers does 12, leaving 36 for two workers — 18 days.' },
  { id: 'c6', domain: 'case', difficulty: 3,
    question: 'A tank fills in 6 hours through pipe A and 4 hours through pipe B, while an open drain empties it in 12 hours. With all three open, how long does it take to fill?',
    options: ['3 hours', '2 hours', '4 hours', '5 hours'], answer: 0,
    explanation: 'Per hour: 1/6 + 1/4 - 1/12 = 1/3 of the tank. Three hours.' },
  { id: 'c7', domain: 'case', difficulty: 3,
    question: 'A company\'s sales rose 10% one year and fell 10% the next. Compared with where they started, sales are now:',
    options: ['1% lower', 'The same', '1% higher', '2% lower'], answer: 0,
    explanation: 'The rise and the fall apply to different totals: 1.10 × 0.90 = 0.99.' },
  { id: 'c8', domain: 'case', difficulty: 3,
    question: 'A test detects a disease in 90% of people who have it, but also reads positive for 9% of healthy people. One person in 100 has the disease. Someone tests positive. Roughly how likely is it that they have it?',
    options: ['About 9%', 'About 90%', 'About 50%', 'About 1%'], answer: 0,
    explanation: 'In 1000 people, 10 are ill and about 9 test positive; of the 990 healthy, about 89 also test positive. So 9 of roughly 98 positives are genuine — under 10%.' },
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
  const domains: Domain[] = ['series', 'analogy', 'logic', 'pattern', 'numeric', 'case'];
  const picked: Item[] = [];

  // Two from every domain — one from the gentler end, one from the harder —
  // so no single way of thinking decides the whole result.
  for (const d of domains) {
    const pool = ITEM_BANK.filter(i => i.domain === d);
    const easy = shuffle(pool.filter(i => i.difficulty === 1));
    const mid = shuffle(pool.filter(i => i.difficulty === 2));
    const hard = shuffle(pool.filter(i => i.difficulty === 3));

    const first = easy[0] ?? mid[0];
    if (first) picked.push(first);
    const second = hard[0] ?? mid.find(i => i !== first);
    if (second) picked.push(second);
  }

  // Remaining slots go to the harder end of what is left — that is where the
  // test actually tells people apart. Sort is stable, so the shuffle still
  // decides the order within a tier.
  const rest = shuffle(ITEM_BANK.filter(i => !picked.includes(i)))
    .sort((a, b) => b.difficulty - a.difficulty);
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
