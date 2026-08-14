/**
 * Pulls a multiple-choice question out of an assistant reply so the options
 * can be shown as buttons instead of a line the reader has to type back.
 *
 * This reads what the model already wrote rather than asking it to emit a
 * special format — the tutor keeps its own voice, and a reply that happens not
 * to be a question simply parses to null and renders as ordinary text.
 *
 * Options may share one line ("A) Red B) Blue C) Green") or sit on separate
 * lines, with or without markdown emphasis around the label.
 */

export interface McqOption {
  label: string;
  text: string;
}

export interface Mcq {
  /** The reply with the option list removed, still markdown. */
  body: string;
  options: McqOption[];
}

/**
 * A label is a letter, a closing mark, then a space — allowing markdown
 * emphasis to sit on either side of it, as in `**A)** Alpha`.
 */
const LABEL = /(?:^|[\s*_([])([A-Da-d])[).:\]][*_]*\s+/g;

/** Long "options" mean the letter was really prose, not a choice. */
const MAX_OPTION_LEN = 160;

export function parseMcq(raw: string): Mcq | null {
  if (!raw || raw.length > 6000) return null;

  const hits: { letter: string; start: number; end: number }[] = [];
  LABEL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LABEL.exec(raw)) !== null) {
    // match[0] may include the preceding character; the label starts where the
    // captured letter does.
    const letterAt = m.index + m[0].indexOf(m[1]);
    hits.push({ letter: m[1].toUpperCase(), start: letterAt, end: m.index + m[0].length });
  }

  // Keep the longest run that starts at A and steps A, B, C, ... in order.
  let best: typeof hits = [];
  for (let i = 0; i < hits.length; i++) {
    if (hits[i].letter !== 'A') continue;
    const run = [hits[i]];
    for (let j = i + 1; j < hits.length; j++) {
      const expected = String.fromCharCode(65 + run.length);
      if (hits[j].letter === expected) run.push(hits[j]);
      else if (hits[j].letter === 'A') break;
    }
    if (run.length > best.length) best = run;
  }

  if (best.length < 3) return null;

  const options: McqOption[] = [];
  for (let i = 0; i < best.length; i++) {
    const from = best[i].end;
    // Every option but the last ends where the next label begins. The last one
    // ends at its own line break, so a closing sentence after the list is not
    // swallowed into it.
    const nextLine = raw.indexOf('\n', from);
    const to =
      i + 1 < best.length
        ? best[i + 1].start
        : nextLine === -1
          ? raw.length
          : nextLine;

    const text = clean(raw.slice(from, to));
    if (!text || text.length > MAX_OPTION_LEN) return null;
    options.push({ label: best[i].letter, text });
  }

  // Step back over any emphasis that opened before the first label, so
  // `**A)** Alpha` does not leave a stray `**` behind in the body.
  let spanStart = best[0].start;
  while (spanStart > 0 && (raw[spanStart - 1] === '*' || raw[spanStart - 1] === '_')) {
    spanStart--;
  }
  const lastEnd = (() => {
    const nl = raw.indexOf('\n', best[best.length - 1].end);
    return nl === -1 ? raw.length : nl;
  })();

  const body = (raw.slice(0, spanStart) + '\n' + raw.slice(lastEnd))
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { body, options };
}

/** Drops trailing separators and the markdown emphasis around a choice. */
function clean(s: string): string {
  return s
    .replace(/^[\s*_-]+/, '')
    .replace(/[\s*_,;|-]+$/, '')
    .replace(/\*\*/g, '')
    .trim();
}
