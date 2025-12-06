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





// Irregular verbs mapping to more correct surface forms to improve matching of
// common verbs where simple -ed/-ing generation would be wrong (e.g. hold -> held)
const IRREGULAR_VERBS: Record<string, string[]> = {
  hold: ['hold', 'holds', 'held', 'holding'],
  make: ['make', 'makes', 'made', 'making'],
  take: ['take', 'takes', 'took', 'taking', 'taken'],
  bring: ['bring', 'brings', 'brought', 'bringing'],
  get: ['get', 'gets', 'got', 'getting', 'gotten'],
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
  /* c8 ignore next -- buildSentenceParts 会提前过滤空答案 */
  if (!normalized) {
    return [];
  }

  const parts = normalized.split(' ');
  /* c8 ignore next -- normalized 不会为空字符串 */
  if (!parts.length) {
    return [];
  }

  const firstWord = parts[0];
  const baseTail = parts.slice(1);
  const variants = new Set<string>([normalized]);
  const lowerFirst = firstWord.toLowerCase();
  const candidateFirstWords = INFLECTION_MAP[lowerFirst] ?? IRREGULAR_VERBS[lowerFirst] ?? buildRegularWordForms(firstWord);

  // 1) 基本组合：对首词的不同词形与尾部组合
  candidateFirstWords.forEach((variant) => {
    const phrase = [variant, ...baseTail].join(' ');
    variants.add(phrase.trim());
  });

  // 2) 处理占位符 (sb / someone / somebody)——替换为多种人称/所有格并生成可变体
  const placeholderRegex = /^(sb|someone|somebody)(?:'s|’s)?\.?$/i;
  const placeholderIndex = parts.findIndex((p) => placeholderRegex.test(p));
  if (placeholderIndex >= 0) {
    const prefix = parts.slice(0, placeholderIndex);
    const tail = parts.slice(placeholderIndex + 1);

    // 常用对象/主格/所有格替换集合，覆盖常见场景
    const objectPronouns = ['him', 'her', 'them', 'us', 'me', 'you'];
    const subjectPronouns = ['he', 'she', 'they', 'we', 'i', 'you'];
    const possessivePronouns = ['his', 'her', 'their', 'my', 'your', 'our'];

    // 首词可能是一个动词（例如 `hold`），这里对首词做词形变换后再组合
    const prefixFirst = prefix[0] ?? '';
    const prefixRest = prefix.slice(1);
    const candidatePrefixFirstForms =
      INFLECTION_MAP[prefixFirst?.toLowerCase()] ?? IRREGULAR_VERBS[prefixFirst?.toLowerCase()] ?? buildRegularWordForms(prefixFirst || '');

    // 生成主动语态下的对象替换（hold him ...）
    candidatePrefixFirstForms.forEach((f) => {
      objectPronouns.forEach((obj) => {
        const partsCandidate = [...(f ? [f] : []), ...prefixRest, obj, ...tail].filter(Boolean);
        variants.add(partsCandidate.join(' ').trim());
      });
    });

    // 生成主语 + 动词 + rest 的变体（he holds him ...，用于某些主语出现在短语前的情况）
    candidatePrefixFirstForms.forEach((f) => {
      subjectPronouns.forEach((sub) => {
        const partsCandidate = [sub, f, ...prefixRest, ...tail].filter(Boolean);
        variants.add(partsCandidate.join(' ').trim());
      });
    });

    // 所有格替换，例如 sb's -> his/her/their ...
    possessivePronouns.forEach((p) => {
      const partsCandidate = [...prefix, p, ...tail].filter(Boolean);
      variants.add(partsCandidate.join(' ').trim());
    });

    // 生成被动形式，例如 was held accountable / were held ...
    // 尝试使用已知的不规则过去分词或简单的 ed 形式
    const baseVerb = prefixFirst?.toLowerCase();
    const irregularForms = IRREGULAR_VERBS[baseVerb] ?? [];
    // 找到一个合理的过去分词（优先选 irregular 的第三项或以 ed 结尾的形式）
    let pastParticiple = '';
    if (irregularForms.length) {
      const found = irregularForms.find((v) => v.endsWith('ed') || v === 'held' || v === 'made' || v === 'taken' || v === 'brought' || v === 'got' || v === 'gotten');
      pastParticiple = found ?? irregularForms[2] ?? irregularForms[1] ?? irregularForms[0] ?? '';
    } else if (prefixFirst) {
      // fallback: try simple '-ed' form
      pastParticiple = `${prefixFirst}ed`;
    }

    if (pastParticiple) {
      const beForms = INFLECTION_MAP.be;
      beForms.forEach((be) => {
        const partsCandidate = [be, pastParticiple, ...prefixRest, ...tail].filter(Boolean);
        variants.add(partsCandidate.join(' ').trim());
      });

      // 也加上仅 pastParticiple + tail（有时主语/aux 在外部）
      const ppCandidate = [pastParticiple, ...prefixRest, ...tail].filter(Boolean);
      variants.add(ppCandidate.join(' ').trim());
    }
  }

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
  /* c8 ignore next -- 经过前置检查 variants 至少包含原始答案 */
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
