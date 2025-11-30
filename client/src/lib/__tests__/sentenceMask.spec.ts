import { describe, expect, it } from 'vitest';
import { buildSentenceParts } from '../sentenceMask';

describe('buildSentenceParts', () => {
  it('返回 null 当句子或答案为空', () => {
    expect(buildSentenceParts('', 'answer')).toBeNull();
    expect(buildSentenceParts('sentence', '')).toBeNull();
  });

  it('能根据答案生成遮挡片段', () => {
    const result = buildSentenceParts('I love sharing apples with friends.', 'sharing apples');
    expect(result).not.toBeNull();
    expect(result?.parts).toHaveLength(3);
    expect(result?.parts[1]).toMatchObject({ type: 'blank' });
    expect(result?.matchedVariant.toLowerCase()).toContain('sharing apples');
  });

  it('未命中目标时返回 null', () => {
    expect(buildSentenceParts('Completely different sentence.', '不存在')).toBeNull();
  });

  it('支持多种词形并返回匹配的具体变体', () => {
    const result = buildSentenceParts('They were running late.', 'be running');
    expect(result?.matchedVariant.toLowerCase()).toContain('were running');
  });

  it('支持以 e 结尾动词的词形变化', () => {
    const result = buildSentenceParts('They glided across the ice.', 'glide');
    expect(result?.matchedVariant.toLowerCase()).toContain('glided');
  });

  it('支持 sb 占位并匹配 he/him 变体', () => {
    const result = buildSentenceParts('We must hold him accountable for his actions.', 'hold sb accountable for');
    expect(result).not.toBeNull();
    expect(result?.matchedVariant.toLowerCase()).toContain('hold him accountable');
  });

  it('支持被动语态的 past-participle 匹配', () => {
    const result = buildSentenceParts('She was held accountable for the failure.', 'hold sb accountable for');
    expect(result).not.toBeNull();
    // 被动形式可能包含 was held accountable
    expect(result?.matchedVariant.toLowerCase()).toContain('held accountable');
  });

  it('支持 sb 占位符并能匹配句子中使用的人称 (hold sb accountable for -> hold him accountable for)', () => {
    const result = buildSentenceParts('We must hold him accountable for his actions.', 'hold sb accountable for');
    expect(result).not.toBeNull();
    expect(result?.matchedVariant.toLowerCase()).toContain('hold him accountable for');
  });

  it('支持被动/过去分词形式的匹配 (was held accountable for)', () => {
    const result = buildSentenceParts('She was held accountable for the failure.', 'hold sb accountable for');
    expect(result).not.toBeNull();
    expect(result?.matchedVariant.toLowerCase()).toContain('was held accountable for');
  });
});
