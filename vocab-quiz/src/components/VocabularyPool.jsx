import { useState } from 'react';

/**
 * VocabularyPool组件 - 展示可拖拽的词汇池
 * @param {Array<String>} vocabularyList - 词汇数组
 * @param {Array<String>} usedWords - 已使用的词汇数组
 * @param {Boolean} submitted - 是否已提交
 * @param {Function} onWordDraggedBack - 词汇被拖回时的回调
 * @param {Boolean} isSticky - 是否使用固定定位
 */
function VocabularyPool({ vocabularyList, usedWords = [], submitted = false, onWordDraggedBack, isSticky = true }) {
  const [draggingWord, setDraggingWord] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 过滤掉已使用的词汇（在未提交状态下）
  const availableWords = submitted ? vocabularyList : vocabularyList.filter(word => !usedWords.includes(word));

  const handleDragStart = (e, word) => {
    e.dataTransfer.setData('text', word);
    e.dataTransfer.setData('sourceQuestionId', ''); // 标记为从词汇池拖出
    setDraggingWord(word);
  };

  const handleDragEnd = () => {
    setDraggingWord(null);
  };

  // 处理词汇被拖回词汇池
  const handleDragOver = (e) => {
    if (submitted) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    if (submitted) return;
    e.preventDefault();
    setIsDragOver(false);
    
    const sourceQuestionId = e.dataTransfer.getData('sourceQuestionId');
    
    // 只处理从题目拖回的词汇（sourceQuestionId 不为空）
    if (sourceQuestionId !== '' && sourceQuestionId !== null && sourceQuestionId !== undefined) {
      const questionId = parseInt(sourceQuestionId, 10);
      // 验证 questionId 是有效的数字
      if (!isNaN(questionId) && onWordDraggedBack) {
        onWordDraggedBack(questionId);
      }
    }
  };

  const containerStyle = {
    position: isSticky ? 'sticky' : 'relative',
    top: isSticky ? '10px' : 'auto',
    backgroundColor: isDragOver ? '#fff3e6' : '#f5f5f5',
    border: isDragOver ? '3px dashed #ff8c42' : '2px solid #ff8c42',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '30px',
    zIndex: isSticky ? 1000 : 1,
    boxShadow: isDragOver ? '0 6px 16px rgba(255, 140, 66, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
    maxHeight: isSticky ? '80vh' : 'none',
    overflowY: isSticky ? 'auto' : 'visible',
    transition: 'all 0.3s ease-in-out'
  };

  const titleStyle = {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#333',
    backgroundColor: '#fff3e6',
    padding: '8px 12px',
    borderRadius: '6px',
    borderLeft: '4px solid #ff8c42',
    position: 'sticky',
    top: '0',
    zIndex: 1
  };

  const wordsContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px'
  };

  const getWordStyle = (word) => ({
    display: 'inline-block',
    backgroundColor: '#ffffff',
    border: '2px solid #ccc',
    borderRadius: '6px',
    padding: '10px 14px',
    margin: '5px',
    cursor: submitted ? 'not-allowed' : 'move',
    fontSize: '14px',
    fontWeight: '500',
    userSelect: 'none',
    opacity: draggingWord === word ? 0.5 : 1,
    transition: 'all 0.2s',
    boxShadow: draggingWord === word ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
    transform: draggingWord === word ? 'scale(0.95)' : 'scale(1)'
  });

  return (
    <div 
      style={containerStyle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={titleStyle}>
        词汇池 (Vocabulary Pool)
        {!submitted && usedWords.length > 0 && (
          <span style={{ fontSize: '14px', color: '#666', marginLeft: '10px', fontWeight: 'normal' }}>
            剩余: {availableWords.length} / {vocabularyList.length}
          </span>
        )}
        {isDragOver && !submitted && (
          <span style={{ fontSize: '12px', color: '#ff8c42', marginLeft: '10px', fontWeight: 'normal' }}>
            ↵ 拖放到这里移除词汇
          </span>
        )}
      </div>
      <div style={wordsContainerStyle}>
        {availableWords.map((word, index) => (
          <div
            key={index}
            draggable={!submitted}
            onDragStart={(e) => handleDragStart(e, word)}
            onDragEnd={handleDragEnd}
            style={getWordStyle(word)}
          >
            {word}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VocabularyPool;
