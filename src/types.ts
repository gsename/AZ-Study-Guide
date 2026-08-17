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
  /**
   * The verbatim "Skills measured" bullets this objective owns, copied word for
   * word from the official study guide. Never paraphrase these: they are the
   * traceability spine that makes blueprint coverage measurable.
   */
  officialSkills: string[]
  /**
   * The official sub-skill heading these bullets come from. Two objectives may
   * share one heading when a sub-skill is too broad for a single quiz file
   * (SC-500 splits "Secure access to resources by using Microsoft Entra ID"
   * into human identity and workload identity), so coverage is computed per
   * official area rather than per objective.
   */
  officialSkillArea?: string
  /** Stable per-bullet reference codes (`d1a1`, `d3a11`) used by `QuizQuestion.skillRef`. */
  skillRefs?: string[]
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

/**
 * Ten authored types over only THREE grading shapes — see `QuestionResponse`.
 * That is why `isQuestionCorrect` stays short: `statement-grid`, `drag-match`
 * and `dropdown-sentence` are all label→value maps and reuse `{kind:'fields'}`;
 * `build-list` reuses `{kind:'order'}`. None of the four needed a new response
 * shape, only a renderer.
 */
export type QuestionType =
  | 'single'
  | 'multiple'
  | 'case-study'
  | 'solution-goal'
  | 'reorder'
  | 'active-screen'
  | 'statement-grid'
  | 'drag-match'
  | 'dropdown-sentence'
  | 'build-list'
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

/**
 * One row of a `statement-grid` — the "For each of the following statements,
 * select Yes if the statement is true" format.
 */
export interface GridStatement {
  id: string
  text: string
  /** 'Yes' or 'No'. */
  correctValue: string
}

/** One drop target of a `drag-match`. `correctSource` must appear in `sources`. */
export interface MatchTarget {
  id: string
  label: string
  correctSource: string
}

/** One blank of a `dropdown-sentence`, referenced from `template` as `[[id]]`. */
export interface SentenceBlank {
  id: string
  options: string[]
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

  /**
   * The section of the frozen fact sheet (`tools/facts-<certId>.md`) this item's
   * facts come from. Makes fact-checking happen once per fact instead of once
   * per item, and lets the bank validator prove provenance rather than assume it.
   */
  src?: string
  /**
   * Index — or indices — in `choices` of the deliberate outdated-practice
   * distractor, drawn from the fact sheet's stock table. Never a correct index.
   */
  outdated?: number | number[]
  /**
   * The official "Skills measured" bullet this item tests (`d3a11`), matching a
   * code in the owning objective's `skillRefs`. This is what makes blueprint
   * coverage measurable instead of asserted.
   */
  skillRef?: string
  /**
   * Set when the item is decided by a CONSTRAINT rather than by knowing one fact:
   * several options would do the job and only one respects it. Three axes, which
   * are the three the practice assessments actually use — least privilege, lowest
   * cost, and widest coverage ("the highest level of protection, leaving no
   * gaps"). This is the question shape a real exam leans on and the bank did not
   * have, so the draw reserves a share of each domain's allocation for it.
   *
   * A marker rather than a regex over `prompt`: matching English prose would
   * misclassify silently, and the draw would then miss its target with nothing
   * saying so. `check-bank.mjs` asserts the equivalence in both directions —
   * marker set iff the prompt carries a clause — so the two cannot drift.
   */
  decision?: 'least-privilege' | 'cost' | 'coverage'

  // single / multiple / case-study / solution-goal (unused by the typed formats)
  choices?: string[]
  correctAnswers?: string[]

  // reorder only: items listed here in the CORRECT order; the UI shuffles
  // them for display and grades by comparing the arranged order to this list.
  reorderItems?: string[]

  // active-screen only: a mock, declarative "portal screen" made of fields.
  screenTitle?: string
  fields?: ActiveScreenField[]

  // statement-grid only: rows answered Yes or No independently.
  statements?: GridStatement[]

  // drag-match only: `sources` is the draggable pool and SHOULD contain
  // distractors beyond the ones any target needs.
  sources?: string[]
  targets?: MatchTarget[]

  // dropdown-sentence only: `template` carries `[[blankId]]` placeholders that
  // are replaced by inline selects, e.g. "Use [[b1]] to grant [[b2]]".
  template?: string
  blanks?: SentenceBlank[]

  // build-list only: `poolItems` is a SUPERSET of `correctOrder`, so the learner
  // must exclude as well as order — which is what makes it harder than reorder.
  poolItems?: string[]
  correctOrder?: string[]
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
  /**
   * What the learner actually answered. Added in Dexie v2: a boolean alone
   * cannot support "show me the mistakes I keep making", and the data to build
   * it cannot be recovered after the fact. Optional because rows written before
   * v2 have none.
   */
  response?: QuestionResponse
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
