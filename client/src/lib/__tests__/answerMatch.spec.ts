import { describe, expect, it } from 'vitest';
import { normalizeAnswer, matchAnswer, generateFirstLetterHint } from '../answerMatch';

describe('normalizeAnswer', () => {
  it('转换为小写', () => {
    expect(normalizeAnswer('MISANTHROPE')).toBe('misanthrope');
    expect(normalizeAnswer('MisAnthrope')).toBe('misanthrope');
  });

  it('全角字符转半角', () => {
    expect(normalizeAnswer('ｍｉｓａｎｔｈｒｏｐｅ')).toBe('misanthrope');
    expect(normalizeAnswer('ＡＢＣ')).toBe('abc');
  });

  it('压缩多余空格', () => {
    expect(normalizeAnswer('hello  world')).toBe('hello world');
    expect(normalizeAnswer('be   the   cat')).toBe('be the cat');
  });

  it('去除首尾空格', () => {
    expect(normalizeAnswer('  misanthrope  ')).toBe('misanthrope');
  });

  it('移除连字符', () => {
    expect(normalizeAnswer('well-known')).toBe('wellknown');
    expect(normalizeAnswer('self-esteem')).toBe('selfesteem');
  });

  it('保留连字符选项', () => {
    expect(normalizeAnswer('well-known', false)).toBe('well-known');
  });
});

describe('matchAnswer', () => {
  it('大小写不敏感', () => {
    expect(matchAnswer('MISANTHROPE', 'misanthrope')).toBe(true);
    expect(matchAnswer('Misanthrope', 'misanthrope')).toBe(true);
  });

  it('多余空格容忍', () => {
    expect(matchAnswer('be  the cat', 'be the cat')).toBe(true);
    expect(matchAnswer('hold him  accountable', 'hold him accountable')).toBe(true);
  });

  it('全角半角自动转换', () => {
    expect(matchAnswer('ｔｅｓｔ', 'test')).toBe(true);
    expect(matchAnswer('ａｂｃ　ｄｅｆ', 'abc def')).toBe(true); // 全角空格
  });

  it('连字符可选', () => {
    expect(matchAnswer('wellknown', 'well-known')).toBe(true);
    expect(matchAnswer('well-known', 'wellknown')).toBe(true);
    expect(matchAnswer('well-known', 'well-known')).toBe(true);
  });

  it('撇号需要精确匹配', () => {
    expect(matchAnswer("cat's whiskers", "cat's whiskers")).toBe(true);
    expect(matchAnswer('cats whiskers', "cat's whiskers")).toBe(false);
  });

  it('错误答案返回 false', () => {
    expect(matchAnswer('wrong', 'correct')).toBe(false);
    expect(matchAnswer('misanthrope', 'philanthropist')).toBe(false);
  });

  it('短语匹配', () => {
    expect(matchAnswer('be the cats whiskers', "be the cat's whiskers")).toBe(false); // 缺撇号
    expect(matchAnswer("be the cat's whiskers", "be the cat's whiskers")).toBe(true);
    expect(matchAnswer("BE THE CAT'S WHISKERS", "be the cat's whiskers")).toBe(true);
  });
});

describe('generateFirstLetterHint', () => {
  it('生成单词的首字母提示', () => {
    expect(generateFirstLetterHint('misanthrope')).toBe('m_____');
    expect(generateFirstLetterHint('test')).toBe('t_____');
  });

  it('短语只显示第一个单词的首字母', () => {
    expect(generateFirstLetterHint("be the cat's whiskers")).toBe('b_____');
    expect(generateFirstLetterHint('hold sb accountable')).toBe('h_____');
  });

  it('首字母转小写', () => {
    expect(generateFirstLetterHint('MISANTHROPE')).toBe('m_____');
    expect(generateFirstLetterHint('Test')).toBe('t_____');
  });

  it('空字符串返回默认值', () => {
    expect(generateFirstLetterHint('')).toBe('_____');
    expect(generateFirstLetterHint('   ')).toBe('_____');
  });
});
