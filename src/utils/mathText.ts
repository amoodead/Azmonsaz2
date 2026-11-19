export interface TextSegment {
  text: string;
  kind: 'text' | 'math' | 'latin';
}

const MATH_ATOM = '(?:\\(?[+\\-−]?[0-9۰-۹a-zA-Zπ√]+(?:[.,/][0-9۰-۹a-zA-Z]+)?\\)?(?:\\([^()\\n]{1,24}\\))?)';
const MATH_OP = '[+\\-−×÷*/=^<>≤≥±]';

/**
 * Splits Persian exam text into natural prose, isolated LTR math expressions/signed numbers,
 * and isolated LTR Latin/English spans so RTL BiDi never flips '-', '+', '=', or English punctuation.
 */
export function segmentExamText(input: string): TextSegment[] {
  if (!input) return [];

  const tokenRegex = new RegExp(
    [
      // Multi-term math expression / equation / fraction chain (e.g., n(n-3)/2 = 3n, (-3) + (+7) - 5, 2x - 5 = 11)
      `(?:${MATH_ATOM}(?:\\s*${MATH_OP}\\s*${MATH_ATOM})+)`,
      // Function-like algebraic expression e.g. n(n-3) or 2(x+1)
      `(?:[0-9۰-۹a-zA-Z]+\\([^()\\n]*${MATH_OP}[^()\\n]*\\))`,
      // Coordinate pairs like (3, -2) or (-4, 5)
      `(?:\\(\\s*[+\\-−]?[0-9۰-۹]+(?:[.,/][0-9۰-۹]+)?\\s*,\\s*[+\\-−]?[0-9۰-۹]+(?:[.,/][0-9۰-۹]+)?\\s*\\))`,
      // Standalone signed number like -12, +7, -3/4, -۵ (preceded by start, whitespace, or Persian/opening punct)
      `(?:(?<=^|[\\s(«:،؛])[+\\-−][0-9۰-۹]+(?:[./][0-9۰-۹]+)?)`,
      // Simple fraction like 3/4 or ۳/۴
      `(?:[0-9۰-۹]+\\/[0-9۰-۹]+)`,
      // English words/phrases including blanks (e.g. "A: Can your brother paint? B: No, he ________.")
      `(?:[A-Za-z][A-Za-z0-9\\s'’.,?!:\\-_/]*[A-Za-z0-9?!._])`,
      // Single English variable/word when not surrounded by Persian letters
      `(?:(?<=^|[\\s(«:،؛])[A-Za-z](?=$|[\\s)».,،؛؟:]))`,
    ].join('|'),
    'g'
  );

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(tokenRegex)) {
    const idx = match.index ?? 0;
    const raw = match[0];

    if (idx > lastIndex) {
      segments.push({ text: input.slice(lastIndex, idx), kind: 'text' });
    }

    const isMultiWordEnglish = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(raw);
    const hasMathOperatorOrFraction =
      /[+−×÷*/=^<>≤≥±]/.test(raw) ||
      /(^|[\s(a-zA-Z0-9۰-۹])[+-][0-9۰-۹]/.test(raw) ||
      /[0-9۰-۹]\/[0-9۰-۹]/.test(raw);

    if (hasMathOperatorOrFraction && !isMultiWordEnglish) {
      const normalizedMath = raw
        .replace(/([0-9۰-۹a-zA-Z)])\s*-\s*/g, '$1 − ')
        .replace(/(^|\()\s*-(?=[0-9۰-۹a-zA-Z(])/g, '$1−')
        .replace(/\s*\*\s*/g, ' × ')
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s{2,}/g, ' ')
        .trim();
      segments.push({ text: normalizedMath, kind: 'math' });
    } else if (/[A-Za-z]/.test(raw)) {
      segments.push({ text: raw, kind: 'latin' });
    } else {
      segments.push({ text: raw, kind: 'text' });
    }

    lastIndex = idx + raw.length;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex), kind: 'text' });
  }

  return segments;
}

export function renderExamTextToHtml(input: string, darkContext = false): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return segmentExamText(input)
    .map((seg) => {
      if (seg.kind === 'math') {
        const bg = darkContext ? 'rgba(255,255,255,0.14)' : '#f1f2f4';
        const border = darkContext ? 'rgba(255,255,255,0.28)' : '#d4d7dd';
        const color = darkContext ? '#ffffff' : '#0f172a';
        return `<span dir="ltr" style="display:inline-block;unicode-bidi:isolate;font-family:'Roboto Mono','Vazirmatn',monospace;font-weight:700;padding:1px 6px;margin:0 2px;border-radius:4px;background:${bg};border:1px solid ${border};color:${color};">${escape(seg.text)}</span>`;
      }
      if (seg.kind === 'latin') {
        return `<span dir="ltr" style="display:inline-block;unicode-bidi:isolate;font-weight:600;margin:0 2px;">${escape(seg.text)}</span>`;
      }
      return escape(seg.text);
    })
    .join('');
}

export interface QuestionSubItem {
  label: string;
  text: string;
}

export interface StructuredQuestion {
  intro: string;
  items: QuestionSubItem[];
  outro: string;
}

const PERSIAN_LETTERS = new Set(['الف', 'ب', 'ج', 'د', 'هـ', 'ه', 'و']);

/**
 * Extracts structured sub-items like "الف) ... ب) ... ج) ..." or "۱) ... ۲) ..."
 * from a question stem so multi-part questions render cleanly on separate rows instead of jumbling inline.
 */
export function parseStructuredQuestion(input: string): StructuredQuestion {
  const trimmed = (input || '').trim();
  if (!trimmed) return { intro: '', items: [], outro: '' };

  // Match either "(الف)" / "الف)" / "الف:" / "الف-" or Persian numbered items "۱)" / "۲)" preceded by boundary
  const letterRegex =
    /(?:^|(?<=[\s\n؟.:،؛«\-]))(?:\(\s*(الف|ب|ج|د|هـ|ه|و)\s*\)|(الف|ب|ج|د|هـ|ه|و)\s*(?:[):]|(?=\s*-\s*)\-))\s*/g;
  const numberRegex = /(?:^|(?<=[\s\n؟.:،؛]))([۱-۴1-4])\s*\)\s+/g;

  type RawMatch = { index: number; end: number; key: string; label: string };

  const collectMatches = (regex: RegExp, normalize: (k: string) => string): RawMatch[] => {
    const out: RawMatch[] = [];
    for (const m of trimmed.matchAll(regex)) {
      const idx = m.index ?? 0;
      const rawKey = (m[1] || m[2] || '').trim();
      if (!rawKey) continue;
      const norm = normalize(rawKey);
      out.push({
        index: idx,
        end: idx + m[0].length,
        key: norm,
        label: `${norm})`,
      });
    }
    return out;
  };

  let matches = collectMatches(letterRegex, (k) => k);
  const distinctLetters = new Set(matches.map((m) => m.key));

  // Require at least "الف" and "ب" (or 2+ distinct Persian list letters) to avoid splitting prose like "شکل (الف)"
  const hasLetterList =
    distinctLetters.size >= 2 &&
    matches.some((m) => PERSIAN_LETTERS.has(m.key)) &&
    distinctLetters.has('الف') &&
    distinctLetters.has('ب');

  if (!hasLetterList) {
    const numToFa: Record<string, string> = { '1': '۱', '2': '۲', '3': '۳', '4': '۴' };
    const numMatches = collectMatches(numberRegex, (k) => numToFa[k] || k);
    const distinctNums = new Set(numMatches.map((m) => m.key));
    if (distinctNums.size >= 2 && distinctNums.has('۱') && distinctNums.has('۲')) {
      matches = numMatches;
    } else {
      return { intro: trimmed, items: [], outro: '' };
    }
  }

  // Deduplicate keeping first valid sequence starting from الف or ۱
  const startIdx = matches.findIndex((m) => m.key === 'الف' || m.key === '۱');
  const seqMatches = startIdx >= 0 ? matches.slice(startIdx) : matches;
  if (seqMatches.length < 2) {
    return { intro: trimmed, items: [], outro: '' };
  }

  const intro = trimmed.slice(0, seqMatches[0].index).trim();
  const items: QuestionSubItem[] = [];
  let outro = '';

  for (let i = 0; i < seqMatches.length; i++) {
    const curr = seqMatches[i];
    const nextStart = i + 1 < seqMatches.length ? seqMatches[i + 1].index : trimmed.length;
    let body = trimmed.slice(curr.end, nextStart).trim();

    // If this is the last item and there is a newline before a trailing question line, separate it as outro
    if (i === seqMatches.length - 1 && body.includes('\n')) {
      const lines = body
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length >= 2) {
        outro = lines.slice(1).join('\n');
        body = lines[0];
      }
    }

    if (body) {
      items.push({ label: curr.label, text: body });
    }
  }

  if (items.length < 2) {
    return { intro: trimmed, items: [], outro: '' };
  }

  return { intro, items, outro };
}

