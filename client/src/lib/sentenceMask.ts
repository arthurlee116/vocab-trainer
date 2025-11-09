export type SentencePart =
  | { type: 'text'; value: string }
  | { type: 'blank'; length: number };

export interface SentenceMaskResult {
  parts: SentencePart[];
  matchedVariant: string;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const INFLECTION_MAP: Record<string, string[]> = {
  be: ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['have', 'has', 'had', 'having'],
  do: ['do', 'does', 'did', 'doing', 'done'],
};

const buildRegularWordForms = (word: string) => {
  const forms = new Set<string>([word]);
  const lower = word.toLowerCase();
  forms.add(lower);

  if (lower.length > 2) {
    forms.add(`${lower}s`);
    forms.add(`${lower}es`);
    forms.add(`${lower}ed`);
    forms.add(`${lower}ing`);
    if (lower.endsWith('y')) {
      forms.add(`${lower.slice(0, -1)}ies`);
    }
    if (lower.endsWith('e')) {
      forms.add(`${lower.slice(0, -1)}ing`);
      forms.add(`${lower}d`);
    }
  }

  return Array.from(forms);
};

const buildAnswerVariants = (answer: string) => {
  const normalized = answer.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return [];
  }

  const parts = normalized.split(' ');
  if (!parts.length) {
    return [];
  }

  const firstWord = parts[0];
  const baseTail = parts.slice(1);
  const variants = new Set<string>([normalized]);
  const lowerFirst = firstWord.toLowerCase();
  const irregular = INFLECTION_MAP[lowerFirst];
  const candidateFirstWords = irregular ?? buildRegularWordForms(firstWord);

  candidateFirstWords.forEach((variant) => {
    const phrase = [variant, ...baseTail].join(' ');
    variants.add(phrase.trim());
  });

  return Array.from(variants).filter(Boolean);
};

const toRegexFragment = (value: string) =>
  value
    .split(' ')
    .map((segment) => escapeRegExp(segment))
    .join('\\s+');

export const buildSentenceParts = (sentence: string, answer: string): SentenceMaskResult | null => {
  const trimmedSentence = sentence ?? '';
  const trimmedAnswer = answer?.trim();

  if (!trimmedSentence || !trimmedAnswer) {
    return null;
  }

  const variants = buildAnswerVariants(trimmedAnswer);
  if (!variants.length) {
    return null;
  }

  const pattern = variants
    .map((variant) => toRegexFragment(variant))
    .sort((a, b) => b.length - a.length)
    .join('|');

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts: SentencePart[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let matched = false;
  let matchedVariant = '';

  while ((match = regex.exec(trimmedSentence)) !== null) {
    matched = true;
    if (match.index > cursor) {
      parts.push({ type: 'text', value: trimmedSentence.slice(cursor, match.index) });
    }
    matchedVariant = match[0] ?? '';
    const blankLength = matchedVariant.replace(/\s/g, '').length || matchedVariant.length || 0;
    parts.push({ type: 'blank', length: Math.max(blankLength, 1) });
    cursor = match.index + match[0].length;
  }

  if (!matched) {
    return null;
  }

  if (cursor < trimmedSentence.length) {
    parts.push({ type: 'text', value: trimmedSentence.slice(cursor) });
  }

  return {
    parts,
    matchedVariant,
  };
};
