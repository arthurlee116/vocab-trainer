/**
 * 答案批改工具函数
 * 提供大小写忽略、空格处理和结果生成功能
 */

/**
 * 批改拖拽题
 * @param {Object} userAnswers - 用户答案对象 {questionId: answer}
 * @param {Array} questions - 题目数组
 * @returns {Array} 批改结果数组
 */
export function gradeDragQuestions(userAnswers, questions) {
  return questions.map(question => {
    const userAnswer = userAnswers[question.id] || '';
    const correctAnswer = question.answer;
    
    // 标准化答案：转小写
    const normalizedUserAnswer = userAnswer.toLowerCase().trim();
    const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim();
    
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
    
    return {
      questionIndex: question.id,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      isCorrect: isCorrect,
      normalizedUserAnswer: normalizedUserAnswer
    };
  });
}

/**
 * 批改输入题
 * @param {Object} userAnswers - 用户答案对象 {questionId: answer}
 * @param {Array} questions - 题目数组
 * @returns {Array} 批改结果数组
 */
export function gradeInputQuestions(userAnswers, questions) {
  return questions.map(question => {
    const userAnswer = userAnswers[question.id] || '';
    const correctAnswer = question.answer;
    
    // 标准化答案：转小写并去除首尾空格
    const normalizedUserAnswer = userAnswer.toLowerCase().trim();
    const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim();
    
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
    
    return {
      questionIndex: question.id,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      isCorrect: isCorrect,
      normalizedUserAnswer: normalizedUserAnswer
    };
  });
}

/**
 * 计算总分和统计信息
 * @param {Array} dragResults - 拖拽题批改结果
 * @param {Array} inputResults - 输入题批改结果
 * @returns {Object} 统计信息
 */
export function calculateScore(dragResults, inputResults) {
  const dragCorrect = dragResults.filter(r => r.isCorrect).length;
  const inputCorrect = inputResults.filter(r => r.isCorrect).length;
  const totalCorrect = dragCorrect + inputCorrect;
  const totalQuestions = dragResults.length + inputResults.length;
  const percentage = ((totalCorrect / totalQuestions) * 100).toFixed(1);
  
  return {
    dragCorrect,
    inputCorrect,
    totalCorrect,
    totalQuestions,
    percentage
  };
}
