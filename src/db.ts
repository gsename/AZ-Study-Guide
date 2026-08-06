import Dexie, { type Table } from 'dexie'
import type { UserProgress, QuizAttempt, ExamResult, LabProgress } from './types'

class StudyGuideDatabase extends Dexie {
  userProgress!: Table<UserProgress, [string, string]>
  quizAttempts!: Table<QuizAttempt, number>
  examResults!: Table<ExamResult, number>
  labProgress!: Table<LabProgress, [string, string]>

  constructor() {
    super('study-guide-db')
    this.version(1).stores({
      userProgress: '[certId+objectiveId]',
      quizAttempts: '++id, certId, objectiveId, questionId, timestamp, mode, examResultId',
      examResults: '++id, certId, [certId+date]',
      labProgress: '[certId+labId]',
    })
    // v2 adds QuizAttempt.response — what the learner actually answered, not
    // just whether it was right. Mistake review is the core feature of a
    // revision app and cannot be built retroactively over historical rows, so
    // the field lands now even though nothing indexes it. No index change is
    // needed, hence no upgrade() body: existing rows simply have no response.
    this.version(2).stores({
      userProgress: '[certId+objectiveId]',
      quizAttempts: '++id, certId, objectiveId, questionId, timestamp, mode, examResultId',
      examResults: '++id, certId, [certId+date]',
      labProgress: '[certId+labId]',
    })
  }
}

export const db = new StudyGuideDatabase()
