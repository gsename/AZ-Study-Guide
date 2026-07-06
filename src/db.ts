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
  }
}

export const db = new StudyGuideDatabase()
