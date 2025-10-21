import { useState } from 'react';

/**
 * DragQuizSection组件 - 拖拽填空题区域
 * @param {Array<Object>} questions - 题目数组
 * @param {Object} answers - 用户答案对象
 * @param {Function} onAnswerChange - 答案变更回调
 * @param {Boolean} submitted - 是否已提交
 * @param {Array} results - 批改结果数组
 */
function DragQuizSection({ questions, answers, onAnswerChange, submitted, results }) {
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggingFromQuestion, setDraggingFromQuestion] = useState(null);

  const handleDragOver = (e, questionId) => {
    e.preventDefault();
    setDragOverIndex(questionId);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, questionId) => {
    e.preventDefault();
    const word = e.dataTransfer.getData('text');
    const sourceQuestionId = e.dataTransfer.getData('sourceQuestionId');
    
    // 如果是从其他题目拖拽过来，先清空原题目
    if (sourceQuestionId !== '' && sourceQuestionId !== null && sourceQuestionId !== undefined) {
      const sourceId = parseInt(sourceQuestionId, 10);
      // 验证 sourceId 是有效的数字且不等于目标题目
      if (!isNaN(sourceId) && sourceId !== questionId) {
        onAnswerChange(sourceId, ''); // 清空原题目
      }
    }
    
    // 只有当 word 存在且不为空时才设置答案
    if (word && word.trim() !== '') {
      onAnswerChange(questionId, word);
    }
    
    setDragOverIndex(null);
    setDraggingFromQuestion(null);
  };

  // 处理从填空处开始拖拽
  const handleBlankDragStart = (e, questionId, word) => {
    if (submitted || !word) return; // 已提交或词汇为空时不允许拖拽
    
    try {
      e.dataTransfer.setData('text', word);
      e.dataTransfer.setData('sourceQuestionId', questionId.toString());
      setDraggingFromQuestion(questionId);
    } catch (error) {
      console.error('拖拽开始错误:', error);
    }
  };

  const handleBlankDragEnd = () => {
    setDraggingFromQuestion(null);
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
    marginBottom: '15px',
    lineHeight: '1.8',
    fontSize: '15px'
  };

  const questionNumberStyle = {
    fontWeight: 'bold',
    color: '#555',
    marginRight: '8px'
  };

  const getBlankStyle = (questionId) => {
    const hasAnswer = answers[questionId];
    const isHovering = dragOverIndex === questionId;
    const isDragging = draggingFromQuestion === questionId;
    const result = submitted && results ? results.find(r => r.questionIndex === questionId) : null;

    let backgroundColor = '#ffffff';
    let borderBottom = '2px dashed #ccc';
    let color = '#333';

    if (submitted && result) {
      if (result.isCorrect) {
        backgroundColor = '#d4edda';
        borderBottom = '2px solid #28a745';
        color = '#155724';
      } else {
        backgroundColor = '#f8d7da';
        borderBottom = '2px solid #dc3545';
        color = '#721c24';
      }
    } else if (hasAnswer) {
      backgroundColor = '#f5f5f5';
      borderBottom = '2px solid #666';
    }

    if (isHovering && !submitted) {
      borderBottom = '2px solid #ff8c42';
    }

    // 拖拽时的特殊样式
    if (isDragging) {
      backgroundColor = '#fff3cd';
    }

    return {
      display: 'inline-block',
      minWidth: '100px',
      padding: '4px 8px',
      borderBottom,
      backgroundColor,
      color,
      cursor: submitted ? 'default' : (hasAnswer ? 'move' : 'pointer'),
      transition: 'all 0.2s',
      marginLeft: '4px',
      marginRight: '4px',
      opacity: isDragging ? 0.6 : 1
    };
  };

  const correctAnswerStyle = {
    color: '#721c24',
    fontSize: '12px',
    marginLeft: '8px',
    fontStyle: 'italic'
  };

  const renderQuestion = (question) => {
    const parts = question.question.split('____');
    const result = submitted && results ? results.find(r => r.questionIndex === question.id) : null;
    const userAnswer = answers[question.id] || '';

    return (
      <div key={question.id} style={questionItemStyle}>
        <span style={questionNumberStyle}>{question.id + 1}.</span>
        <span>{parts[0]}</span>
        <span
          draggable={!submitted && !!userAnswer}
          onDragStart={(e) => handleBlankDragStart(e, question.id, userAnswer)}
          onDragEnd={handleBlankDragEnd}
          onDragOver={(e) => handleDragOver(e, question.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, question.id)}
          style={getBlankStyle(question.id)}
        >
          {userAnswer || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
        </span>
        <span>{parts[1]}</span>
        {submitted && result && !result.isCorrect && (
          <span style={correctAnswerStyle}>
            (正确答案: {result.correctAnswer})
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={sectionStyle}>
      <div style={titleStyle}>Part 1: 拖拽填空题 (Drag and Drop)</div>
      {questions.map(question => renderQuestion(question))}
    </div>
  );
}

export default DragQuizSection;
