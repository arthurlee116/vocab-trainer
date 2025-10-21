// 词汇数据模块 - 包含20个词汇及对应的拖拽题和输入题

export const vocabularyData = [
  {
    word: "beacon",
    dragQuestion: "The lighthouse served as a ____ for ships at sea.",
    dragAnswer: "beacon",
    inputQuestion: "In the dark, the ____ guided the lost travelers.",
    inputAnswer: "beacon"
  },
  {
    word: "berserk",
    dragQuestion: "The warrior went ____ when he saw his fallen comrades.",
    dragAnswer: "berserk",
    inputQuestion: "The crowd went ____ after the controversial decision.",
    inputAnswer: "berserk"
  },
  {
    word: "celestial",
    dragQuestion: "Astronomers study ____ bodies like stars and planets.",
    dragAnswer: "celestial",
    inputQuestion: "The night sky was filled with ____ beauty.",
    inputAnswer: "celestial"
  },
  {
    word: "chasten",
    dragQuestion: "The harsh criticism served to ____ his arrogance.",
    dragAnswer: "chasten",
    inputQuestion: "The defeat will ____ the overconfident team.",
    inputAnswer: "chasten"
  },
  {
    word: "confiscate",
    dragQuestion: "Airport security will ____ any prohibited items.",
    dragAnswer: "confiscate",
    inputQuestion: "Teachers may ____ phones during class time.",
    inputAnswer: "confiscate"
  },
  {
    word: "data",
    dragQuestion: "Scientists collect ____ to support their hypothesis.",
    dragAnswer: "data",
    inputQuestion: "The survey gathered valuable ____ about consumer habits.",
    inputAnswer: "data"
  },
  {
    word: "detract",
    dragQuestion: "Poor lighting can ____ from the beauty of the painting.",
    dragAnswer: "detract",
    inputQuestion: "His rude behavior did not ____ from his achievements.",
    inputAnswer: "detract"
  },
  {
    word: "encounter",
    dragQuestion: "Explorers often ____ unexpected challenges in the wilderness.",
    dragAnswer: "encounter",
    inputQuestion: "I hope to ____ interesting people on my travels.",
    inputAnswer: "encounter"
  },
  {
    word: "epic",
    dragQuestion: "The poet composed an ____ tale of heroic deeds.",
    dragAnswer: "epic",
    inputQuestion: "The film was an ____ story spanning generations.",
    inputAnswer: "epic"
  },
  {
    word: "pantomime",
    dragQuestion: "The actor used ____ to express emotions without words.",
    dragAnswer: "pantomime",
    inputQuestion: "Children enjoy performing ____ at parties.",
    inputAnswer: "pantomime"
  },
  {
    word: "pessimist",
    dragQuestion: "A ____ always expects the worst outcome.",
    dragAnswer: "pessimist",
    inputQuestion: "Don't be such a ____ about the weather forecast.",
    inputAnswer: "pessimist"
  },
  {
    word: "precaution",
    dragQuestion: "Wearing a helmet is a necessary ____ when cycling.",
    dragAnswer: "precaution",
    inputQuestion: "Taking a ____ can prevent future problems.",
    inputAnswer: "precaution"
  },
  {
    word: "prosecute",
    dragQuestion: "The state will ____ anyone who breaks this law.",
    dragAnswer: "prosecute",
    inputQuestion: "Authorities decided to ____ the corrupt officials.",
    inputAnswer: "prosecute"
  },
  {
    word: "puncture",
    dragQuestion: "A sharp nail can ____ a car tire easily.",
    dragAnswer: "puncture",
    inputQuestion: "Be careful not to ____ the balloon with that pin.",
    inputAnswer: "puncture"
  },
  {
    word: "retaliate",
    dragQuestion: "The nation threatened to ____ against the attack.",
    dragAnswer: "retaliate",
    inputQuestion: "He chose not to ____ despite the insult.",
    inputAnswer: "retaliate"
  },
  {
    word: "sham",
    dragQuestion: "The trial was exposed as a complete ____.",
    dragAnswer: "sham",
    inputQuestion: "His concern for others was just a ____.",
    inputAnswer: "sham"
  },
  {
    word: "uncouth",
    dragQuestion: "His ____ manners offended the dinner guests.",
    dragAnswer: "uncouth",
    inputQuestion: "The ____ behavior was unacceptable at the ceremony.",
    inputAnswer: "uncouth"
  },
  {
    word: "underscore",
    dragQuestion: "The incident will ____ the need for better safety measures.",
    dragAnswer: "underscore",
    inputQuestion: "The results ____ the importance of education.",
    inputAnswer: "underscore"
  },
  {
    word: "wholesome",
    dragQuestion: "The farm provides ____ food for the community.",
    dragAnswer: "wholesome",
    inputQuestion: "She promotes a ____ lifestyle for children.",
    inputAnswer: "wholesome"
  },
  {
    word: "wistful",
    dragQuestion: "She cast a ____ glance at her childhood home.",
    dragAnswer: "wistful",
    inputQuestion: "His ____ smile revealed his nostalgia.",
    inputAnswer: "wistful"
  }
];

// 导出词汇列表（用于词汇池）
export const wordList = vocabularyData.map(item => item.word);

// 导出拖拽题列表
export const dragQuestions = vocabularyData.map((item, index) => ({
  id: index,
  question: item.dragQuestion,
  answer: item.dragAnswer
}));

// 导出输入题列表
export const inputQuestions = vocabularyData.map((item, index) => ({
  id: index,
  question: item.inputQuestion,
  answer: item.inputAnswer
}));
