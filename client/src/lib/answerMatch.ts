/**
 * 答案比对工具函数
 * 用于第三大题填空题的用户输入与正确答案比对
 */

/**
 * 全角字符转半角
 */
const toHalfWidth = (str: string): string =>
  str.replace(/[\uff01-\uff5e]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  ).replace(/\u3000/g, ' '); // 全角空格转半角

/**
 * 规范化答案字符串
 * - 转小写
 * - 全角转半角
 * - 压缩多余空格为单个空格
 * - 去除首尾空格
 * - 移除连字符（可选匹配）
 */
export const normalizeAnswer = (input: string, removeHyphen = true): string => {
  let normalized = toHalfWidth(input).toLowerCase().trim();
  // 压缩多余空格
  normalized = normalized.replace(/\s+/g, ' ');
  // 移除连字符（用户可以不输入连字符）
  if (removeHyphen) {
    normalized = normalized.replace(/-/g, '');
  }
  return normalized;
};

/**
 * 比对用户输入与正确答案
 * - 大小写不敏感
 * - 全角/半角自动转换
 * - 多余空格容忍
 * - 连字符可选（用户不输入也算对）
 * - 撇号需要精确匹配
 */
export const matchAnswer = (userInput: string, correctAnswer: string): boolean => {
  const normalizedUser = normalizeAnswer(userInput);
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  
  // 直接比较规范化后的字符串
  if (normalizedUser === normalizedCorrect) {
    return true;
  }
  
  // 额外检查：用户可能输入了连字符而正确答案没有，或反过来
  // 所以也比较不移除连字符的版本
  const userWithHyphen = normalizeAnswer(userInput, false);
  const correctWithHyphen = normalizeAnswer(correctAnswer, false);
  
  return userWithHyphen === correctWithHyphen;
};

/**
 * 生成首字母提示
 * 对于短语，只显示第一个单词的首字母
 * @param answer 正确答案
 * @returns 首字母提示（如 "m_____"）
 */
export const generateFirstLetterHint = (answer: string): string => {
  const trimmed = answer.trim();
  if (!trimmed) return '_____';
  
  const firstChar = trimmed.charAt(0).toLowerCase();
  return `${firstChar}_____`;
};
