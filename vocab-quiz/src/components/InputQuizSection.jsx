import { forwardRef } from 'react';

/**
 * InputQuizSection组件 - 手动输入填空题区域
 * @param {Array<Object>} questions - 题目数组
 * @param {Object} answers - 用户答案对象
 * @param {Function} onAnswerChange - 答案变更回调
 * @param {Boolean} submitted - 是否已提交
 * @param {Array} results - 批改结果数组
 */
const InputQuizSection = forwardRef(({ questions, answers, onAnswerChange, submitted, results }, ref) => {
  const handleInputChange = (e, questionId) => {
    onAnswerChange(questionId, e.target.value);
  };

  const sectionStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
  };

  const titleStyle = {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333',
    borderBottom: '2px solid #ff8c42',
    paddingBottom: '10px'
  };

  const questionItemStyle = {
    marginBottom: '20px',
    lineHeight: '1.8',
    fontSize: '15px'
  };

  const questionNumberStyle = {
    fontWeight: 'bold',
    color: '#555',
    marginRight: '8px'
  };

  const getInputStyle = (questionId) => {
    const result = submitted && results ? results.find(r => r.questionIndex === questionId) : null;

    let backgroundColor = '#ffffff';
    let borderColor = '#ced4da';

    if (submitted && result) {
      if (result.isCorrect) {
        backgroundColor = '#d4edda';
        borderColor = '#28a745';
      } else {
        backgroundColor = '#f8d7da';
        borderColor = '#dc3545';
      }
    } else if (answers[questionId]) {
      borderColor = '#ff8c42';
    }

    return {
      width: '150px',
      padding: '6px 10px',
      border: `1px solid ${borderColor}`,
      borderRadius: '4px',
      fontSize: '14px',
      backgroundColor,
      outline: 'none',
      marginLeft: '4px',
      marginRight: '4px',
      transition: 'all 0.2s'
    };
  };

  const correctAnswerHintStyle = {
    display: 'block',
    color: '#721c24',
    fontSize: '12px',
    marginTop: '5px',
    marginLeft: '20px',
    fontStyle: 'italic'
  };

  const renderQuestion = (question) => {
    const parts = question.question.split('____');
    const result = submitted && results ? results.find(r => r.questionIndex === question.id) : null;
    const userAnswer = answers[question.id] || '';

    return (
      <div key={question.id} style={questionItemStyle}>
        <div>
          <span style={questionNumberStyle}>{question.id + 1}.</span>
          <span>{parts[0]}</span>
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => handleInputChange(e, question.id)}
            disabled={submitted}
            style={getInputStyle(question.id)}
            placeholder="输入答案"
          />
          <span>{parts[1]}</span>
        </div>
        {submitted && result && !result.isCorrect && (
          <span style={correctAnswerHintStyle}>
            正确答案: {result.correctAnswer}
          </span>
        )}
      </div>
    );
  };

  return (
    <div ref={ref} style={sectionStyle}>
      <div style={titleStyle}>Part 2: 手动输入题 (Type In)</div>
      {questions.map(question => renderQuestion(question))}
    </div>
  );
});

export default InputQuizSection;
