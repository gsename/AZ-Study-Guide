export interface WeightRange {
  min: number
  max: number
}

export interface Domain {
  id: string
  name: string
  weightPercent: WeightRange
}

export interface Objective {
  id: string
  domainId: string
  title: string
  description: string
  officialSkills: string[]
}

export interface CommandExample {
  task: string
  cli?: string
  powershell?: string
}

export interface LessonContent {
  objectiveId: string
  summary: string
  keyPoints: string[]
  commonPitfalls: string[]
  learnLinks: string[]
  diagrams?: string[]
  commands?: CommandExample[]
}

export type QuestionType =
  | 'single'
  | 'multiple'
  | 'case-study'
  | 'solution-goal'
  | 'reorder'
  | 'active-screen'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface ActiveScreenField {
  id: string
  label: string
  kind: 'toggle' | 'select'
  /** Required for kind 'select'. */
  options?: string[]
  /** For 'toggle': 'On' or 'Off'. For 'select': the correct option text. */
  correctValue: string
}

export interface QuizQuestion {
  id: string
  objectiveId: string
  type: QuestionType
  prompt: string
  explanation: string
  difficulty: Difficulty
  caseStudyId?: string

  // single / multiple / case-study / solution-goal (unused by reorder / active-screen)
  choices?: string[]
  correctAnswers?: string[]

  // reorder only: items listed here in the CORRECT order; the UI shuffles
  // them for display and grades by comparing the arranged order to this list.
  reorderItems?: string[]

  // active-screen only: a mock, declarative "portal screen" made of fields.
  screenTitle?: string
  fields?: ActiveScreenField[]
}

/**
 * The shape of a learner's answer, discriminated to match how each question
 * type is graded. Choice-based types (single/multiple/case-study/
 * solution-goal) share the 'choices' response.
 */
export type QuestionResponse =
  | { kind: 'choices'; selected: string[] }
  | { kind: 'order'; order: string[] }
  | { kind: 'fields'; values: Record<string, string> }

export interface CaseStudy {
  id: string
  title: string
  scenario: string
}

export interface LabReference {
  id: string
  objectiveId: string
  title: string
  description: string
  azurePortalSteps: string[]
  portalUrl: string
}

// --- User data (persisted in IndexedDB via Dexie) ---

export interface ProgressHistoryEntry {
  date: string
  accuracy: number
  quality: number
  correctCount: number
  totalCount: number
}

export interface UserProgress {
  certId: string
  objectiveId: string
  lastReviewed: string | null
  correctStreak: number
  nextReviewDate: string | null
  easeFactor: number
  intervalDays: number
  repetitions: number
  history: ProgressHistoryEntry[]
}

export interface QuizAttempt {
  id?: number
  certId: string
  objectiveId: string
  questionId: string
  correct: boolean
  mode: 'practice' | 'exam'
  timestamp: string
  examResultId?: number
}

export interface DomainScore {
  domainId: string
  correct: number
  total: number
}

export interface ExamResult {
  id?: number
  certId: string
  date: string
  durationSeconds: number
  totalQuestions: number
  correctCount: number
  scaledScore: number
  passed: boolean
  domainScores: DomainScore[]
}

export interface LabProgress {
  certId: string
  labId: string
  completed: boolean
  completedAt: string | null
}
