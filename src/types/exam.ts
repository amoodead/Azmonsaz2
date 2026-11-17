export type GradeId = '7' | '8' | '9';

export type SubjectId =
  | 'science'
  | 'math'
  | 'persian'
  | 'arabic'
  | 'english'
  | 'social'
  | 'religion';

export type DifficultyLevel = 'easy' | 'standard' | 'advanced';

export interface LessonItem {
  id: string;
  number: number;
  title: string;
  topics: string;
}

export interface SubjectDefinition {
  id: SubjectId;
  name: string;
  shortDesc: string;
  lessonsByGrade: Record<GradeId, LessonItem[]>;
}

export interface ExamConfig {
  grade: GradeId;
  subjectId: SubjectId;
  lessonIds: string[];
  allLessons: boolean;
  customTopic: string;
  questionCount: number;
  difficulty: DifficultyLevel;
  timedMode: boolean;
}

export interface ExamQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  topicTag: string;
  difficultyLabel: string;
  hint: string;
  quickExplanation: string;
}

export interface GeneratedExam {
  examTitle: string;
  subtitle: string;
  recommendedMinutes: number;
  questions: ExamQuestion[];
}

export interface WrongAnswerAnalysisItem {
  questionId: string;
  questionNumber: number;
  wasUnanswered: boolean;
  misconceptionReason: string;
  whyWrongSelected: string;
  correctConceptExplanation: string;
  keyTakeaway: string;
}

export interface ExamAnalysis {
  overallSummary: string;
  strengthTopics: string[];
  weakTopics: string[];
  studyRecommendations: string[];
  wrongBreakdowns: WrongAnswerAnalysisItem[];
}

export interface ExamHistoryEntry {
  id: string;
  createdAt: string;
  config: ExamConfig;
  examTitle: string;
  questions: ExamQuestion[];
  answers: Record<string, number>;
  timeSpentSeconds: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scorePercent: number;
  scoreOutOf20: number;
  analysis?: ExamAnalysis;
}
