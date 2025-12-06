import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { assignWordsToTypes, TypeWordMap } from '../superGenerator.js';

/**
 * **Feature: session-resume, Property 1: Word Assignment Completeness**
 * **Validates: Requirements 1.1**
 * 
 * 对于任意单词列表，当单词分配算法运行时，
 * 每个单词应该恰好出现在 3 种题型数组中的 2 个。
 */
describe('Word Assignment Properties', () => {
  // 生成有效的唯一单词列表（非空字符串数组）
  // 注意：使用 uniqueArray 确保单词不重复，与实际使用场景一致
  // （startGenerationSession 会先对单词进行去重）
  const wordListArb = fc.uniqueArray(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    { minLength: 1, maxLength: 100 }
  );

  it('Property 1: 每个单词恰好出现在 2 种题型中', () => {
    fc.assert(
      fc.property(wordListArb, (words) => {
        const result = assignWordsToTypes(words);
        
        // 对于每个输入单词，统计它出现在多少种题型中
        for (const word of words) {
          let typeCount = 0;
          if (result.questions_type_1.includes(word)) typeCount++;
          if (result.questions_type_2.includes(word)) typeCount++;
          if (result.questions_type_3.includes(word)) typeCount++;
          
          // 每个单词必须恰好出现在 2 种题型中
          expect(typeCount).toBe(2);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: session-resume, Property 2: Total Question Count Invariant**
   * **Validates: Requirements 1.2**
   * 
   * 对于任意大小为 N 的单词列表，生成的总题目数应该恰好等于 N × 2。
   * 因为每个单词分配到 2 种题型，所以总题目数 = 单词数 × 2
   */
  it('Property 2: 总题目数等于单词数 × 2', () => {
    fc.assert(
      fc.property(wordListArb, (words) => {
        const result = assignWordsToTypes(words);
        
        // 计算所有题型中的单词总数
        const totalAssignments = 
          result.questions_type_1.length + 
          result.questions_type_2.length + 
          result.questions_type_3.length;
        
        // 总分配数应该等于单词数 × 2
        expect(totalAssignments).toBe(words.length * 2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: session-resume, Property 3: Type Distribution Balance**
   * **Validates: Requirements 1.3**
   * 
   * 对于任意大小为 N ≥ 30 的单词列表，每种题型应该获得大约 2/3 的单词。
   * 
   * 数学分析：
   * - 每个单词被分配到某个题型的概率 = 2/3（从 3 种中选 2 种）
   * - 期望值 E = N × 2/3
   * - 对于二项分布，标准差 σ = √(N × 2/3 × 1/3) ≈ √(N × 0.222)
   * - 使用 4σ 范围（覆盖 99.99% 的情况）
   * 
   * 对于 N=30: E=20, σ≈2.58, 4σ范围 ≈ [10, 30]
   * 对于 N=100: E=66.7, σ≈4.71, 4σ范围 ≈ [48, 86]
   * 
   * 简化为：每种题型获得 40% 到 90% 的单词（宽松但合理的范围）
   */
  it('Property 3: 题型分布大致均衡（每种题型获得约 2/3 的单词）', () => {
    // 使用较大的唯一单词列表以确保统计意义
    // 注意：使用 uniqueArray 确保单词不重复，与实际使用场景一致
    // （startGenerationSession 会先对单词进行去重）
    const largeWordListArb = fc.uniqueArray(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      { minLength: 30, maxLength: 100 }
    );

    fc.assert(
      fc.property(largeWordListArb, (words) => {
        const result = assignWordsToTypes(words);
        const n = words.length;
        
        // 使用基于统计学的范围：期望值 ± 4σ
        // 期望值 = n × 2/3
        // 标准差 σ = √(n × 2/3 × 1/3)
        const expected = n * (2 / 3);
        const stdDev = Math.sqrt(n * (2 / 3) * (1 / 3));
        const tolerance = 4 * stdDev; // 4σ 覆盖 99.99% 的情况
        
        const minExpected = Math.max(0, Math.floor(expected - tolerance));
        const maxExpected = Math.min(n, Math.ceil(expected + tolerance));
        
        const type1Count = result.questions_type_1.length;
        const type2Count = result.questions_type_2.length;
        const type3Count = result.questions_type_3.length;
        
        // 验证每种题型的单词数在统计合理范围内
        expect(type1Count).toBeGreaterThanOrEqual(minExpected);
        expect(type1Count).toBeLessThanOrEqual(maxExpected);
        
        expect(type2Count).toBeGreaterThanOrEqual(minExpected);
        expect(type2Count).toBeLessThanOrEqual(maxExpected);
        
        expect(type3Count).toBeGreaterThanOrEqual(minExpected);
        expect(type3Count).toBeLessThanOrEqual(maxExpected);
      }),
      { numRuns: 100 }
    );
  });
});
