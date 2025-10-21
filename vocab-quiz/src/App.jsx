import { useState, useMemo, useRef, useEffect } from 'react';
import VocabularyPool from './components/VocabularyPool';
import DragQuizSection from './components/DragQuizSection';
import InputQuizSection from './components/InputQuizSection';
import { wordList, dragQuestions, inputQuestions } from './vocabularyData';
import { gradeDragQuestions, gradeInputQuestions, calculateScore } from './utils/grading';

function App() {
  // 状态管理
  const [dragAnswers, setDragAnswers] = useState({});
  const [inputAnswers, setInputAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [dragResults, setDragResults] = useState([]);
  const [inputResults, setInputResults] = useState([]);
  const [scoreInfo, setScoreInfo] = useState(null);
  const [shuffleKey, setShuffleKey] = useState(0); // 用于触发重新洗牌
  const [isVocabularyPoolSticky, setIsVocabularyPoolSticky] = useState(true); // 控制词汇池是否固定

  // 创建 ref 用于监测第二大题
  const inputSectionRef = useRef(null);

  // 使用 Intersection Observer 监测第二大题是否进入视口
  useEffect(() => {
    const currentRef = inputSectionRef.current; // 保存当前的 ref 值
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        // 当第二大题进入视口时，取消词汇池的固定定位
        if (entry.isIntersecting) {
          setIsVocabularyPoolSticky(false);
        } else {
          setIsVocabularyPoolSticky(true);
        }
      },
      {
        // 当第二大题的顶部进入视口上半部分时触发
        threshold: 0,
        rootMargin: '-20% 0px -80% 0px'
      }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Fisher-Yates 洗牌算法 - 随机打乱词汇顺序
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // 使用 useMemo 缓存随机排序后的词汇列表，只在 shuffleKey 改变时重新洗牌
  const shuffledWordList = useMemo(() => shuffleArray(wordList), [shuffleKey]);

  // 使用 useMemo 缓存随机排序后的输入题列表，只在 shuffleKey 改变时重新洗牌
  const shuffledInputQuestions = useMemo(() => shuffleArray(inputQuestions), [shuffleKey]);

  // 计算已使用的词汇列表（从 dragAnswers 中提取）
  const usedWords = useMemo(() => {
    return Object.values(dragAnswers).filter(word => word); // 过滤掉空值
  }, [dragAnswers]);

  // 拖拽题答案变更处理
  const handleDragAnswerChange = (questionId, answer) => {
    setDragAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  // 处理词汇被拖回词汇池
  const handleWordDraggedBack = (questionId) => {
    setDragAnswers(prev => ({
      ...prev,
      [questionId]: '' // 清空该题目的答案
    }));
  };

  // 输入题答案变更处理
  const handleInputAnswerChange = (questionId, answer) => {
    setInputAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  // 提交答案或重新测验
  const handleSubmit = () => {
    if (!submitted) {
      // 执行批改
      const dragGradeResults = gradeDragQuestions(dragAnswers, dragQuestions);
      const inputGradeResults = gradeInputQuestions(inputAnswers, inputQuestions);
      const score = calculateScore(dragGradeResults, inputGradeResults);
      
      setDragResults(dragGradeResults);
      setInputResults(inputGradeResults);
      setScoreInfo(score);
      setSubmitted(true);
    } else {
      // 重新测验 - 重置所有状态并重新洗牌词汇
      setDragAnswers({});
      setInputAnswers({});
      setDragResults([]);
      setInputResults([]);
      setScoreInfo(null);
      setSubmitted(false);
      setShuffleKey(prev => prev + 1); // 触发词汇重新洗牌
    }
  };

  // 样式定义
  const containerStyle = {
    maxWidth: '1200px',
    margin: '20px auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#fafafa',
    minHeight: '100vh'
  };

  const contentWrapperStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '20px'
  };

  const headerStyle = {
    textAlign: 'center',
    padding: '20px 0',
    marginBottom: '30px'
  };

  const titleStyle = {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '10px'
  };

  const subtitleStyle = {
    fontSize: '16px',
    color: '#666'
  };

  const submitButtonStyle = {
    display: 'block',
    width: '200px',
    margin: '30px auto',
    padding: '12px 24px',
    backgroundColor: submitted ? '#6c757d' : '#ff8c42',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  };

  const scoreDisplayStyle = {
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#ffffff',
    border: '2px solid #ff8c42',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '18px',
    color: '#333'
  };

  const scoreHighlightStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ff8c42',
    margin: '10px 0'
  };

  return (
    <div style={containerStyle}>
      {/* 标题区域 */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>英语词汇测验</h1>
        <p style={subtitleStyle}>English Vocabulary Quiz</p>
      </div>

      {/* 分数显示（仅提交后显示） */}
      {submitted && scoreInfo && (
        <div style={scoreDisplayStyle}>
          <div>测验完成!</div>
          <div style={scoreHighlightStyle}>
            得分: {scoreInfo.totalCorrect} / {scoreInfo.totalQuestions} ({scoreInfo.percentage}%)
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            拖拽题正确: {scoreInfo.dragCorrect}/20 | 输入题正确: {scoreInfo.inputCorrect}/20
          </div>
        </div>
      )}

      <div style={contentWrapperStyle}>
        {/* 词汇池 - 浮动悬浮 */}
        <VocabularyPool 
          vocabularyList={shuffledWordList} 
          usedWords={usedWords}
          submitted={submitted}
          onWordDraggedBack={handleWordDraggedBack}
          isSticky={isVocabularyPoolSticky}
        />

        {/* 拖拽填空题区域 */}
        <DragQuizSection
          questions={dragQuestions}
          answers={dragAnswers}
          onAnswerChange={handleDragAnswerChange}
          submitted={submitted}
          results={dragResults}
        />

        {/* 手动输入题区域 */}
        <InputQuizSection
          ref={inputSectionRef}
          questions={shuffledInputQuestions}
          answers={inputAnswers}
          onAnswerChange={handleInputAnswerChange}
          submitted={submitted}
          results={inputResults}
        />
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        style={submitButtonStyle}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = submitted ? '#5a6268' : '#e67a31';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = submitted ? '#6c757d' : '#ff8c42';
        }}
      >
        {submitted ? '重新测验' : '提交答案'}
      </button>
    </div>
  );
}

export default App;
