import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import {
  loadExamSession,
  saveExamSession,
  clearExamSession,
  remainingSeconds,
  type ExamSessionState,
} from '../lib/examSession'
import { scaleScore, seededShuffle } from '../lib/examBuilder'
import { emptyResponse, hasAnswer, isQuestionCorrect } from '../lib/grading'
import { applySm2Update, createInitialProgress } from '../lib/spacedRepetition'
import { db } from '../db'
import QuestionRenderer from '../components/QuestionRenderer'
import type { DomainScore, QuestionResponse, QuizQuestion } from '../types'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Types with no flat `choices` list to shuffle for display. `build-list` belongs
 * here rather than with `reorder`: it starts empty, since the learner must first
 * decide which pool items are part of the answer at all.
 */
const NO_CHOICE_LIST = new Set<QuizQuestion['type']>([
  'active-screen',
  'statement-grid',
  'drag-match',
  'dropdown-sentence',
  'build-list',
])

function displayFor(question: QuizQuestion, salt: string): { choices?: string[]; order?: string[] } {
  if (question.type === 'reorder') {
    return { order: seededShuffle(question.reorderItems ?? [], `${question.id}:${salt}`) }
  }
  if (NO_CHOICE_LIST.has(question.type)) return {}
  return { choices: seededShuffle(question.choices ?? [], `${question.id}:${salt}`) }
}

export default function ExamSession() {
  const certId = useCertId()
  const { questionsById, objectivesById, caseStudiesById, examMeta } = getCertContent(certId)!
  const navigate = useNavigate()
  const [session, setSession] = useState<ExamSessionState | null>(() => loadExamSession(certId))
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(() => (session ? remainingSeconds(session) : 0))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session) {
      navigate(`/${certId}/exam`)
      return
    }
    const interval = setInterval(() => {
      setRemaining(remainingSeconds(session))
    }, 1000)
    return () => clearInterval(interval)
  }, [session, navigate, certId])

  useEffect(() => {
    if (session && remaining <= 0 && !submitting) {
      void handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  if (!session) return null

  const questions = session.questionIds.map((id) => questionsById[id]).filter(Boolean)
  const current = questions[index]
  const caseStudy = current?.caseStudyId ? caseStudiesById[current.caseStudyId] : null
  const display = current ? displayFor(current, session.startedAt) : {}
  // For an unanswered reorder question, seed the response with the shuffled
  // full item list so there is something to drag (an empty order would
  // render no items at all).
  const currentResponse: QuestionResponse = current
    ? session.answers[current.id] ??
      (current.type === 'reorder'
        ? { kind: 'order', order: display.order ?? [] }
        : emptyResponse(current))
    : { kind: 'choices', selected: [] }
  const lockedSet = new Set(session.lockedQuestionIds)

  function persist(updated: ExamSessionState) {
    setSession(updated)
    saveExamSession(certId, updated)
  }

  function updateResponse(response: QuestionResponse) {
    if (!session || !current || lockedSet.has(current.id)) return
    persist({ ...session, answers: { ...session.answers, [current.id]: response } })
  }

  function toggleChoice(choice: string) {
    if (!current) return
    if (current.type === 'multiple') {
      const prev = currentResponse.kind === 'choices' ? currentResponse.selected : []
      const selected = prev.includes(choice) ? prev.filter((c) => c !== choice) : [...prev, choice]
      updateResponse({ kind: 'choices', selected })
    } else {
      updateResponse({ kind: 'choices', selected: [choice] })
    }
  }

  function reorder(order: string[]) {
    updateResponse({ kind: 'order', order })
  }

  function setField(fieldId: string, value: string) {
    const values = currentResponse.kind === 'fields' ? currentResponse.values : {}
    updateResponse({ kind: 'fields', values: { ...values, [fieldId]: value } })
  }

  /**
   * Mirrors real-exam behavior: leaving a 'solution-goal' question locks it
   * permanently. Called before every navigation away from the current
   * question. Refuses to navigate onto an already-locked question.
   */
  function goToIndex(targetIndex: number) {
    if (!session || targetIndex < 0 || targetIndex >= questions.length) return
    if (targetIndex === index) return
    const targetId = questions[targetIndex].id
    if (lockedSet.has(targetId)) return

    if (current?.type === 'solution-goal' && !lockedSet.has(current.id)) {
      const updated = { ...session, lockedQuestionIds: [...session.lockedQuestionIds, current.id] }
      persist(updated)
    }
    setIndex(targetIndex)
  }

  async function handleSubmit() {
    if (!session || submitting) return
    setSubmitting(true)

    const domainScoreMap = new Map<string, DomainScore>()
    const objectiveOutcomes = new Map<string, { correct: number; total: number }>()
    let correctCount = 0

    questions.forEach((q) => {
      const response = session.answers[q.id] ?? emptyResponse(q)
      const correct = isQuestionCorrect(q, response)
      if (correct) correctCount += 1

      const objective = objectivesById[q.objectiveId]
      const domainId = objective?.domainId ?? 'unknown'
      const domainEntry = domainScoreMap.get(domainId) ?? { domainId, correct: 0, total: 0 }
      domainEntry.total += 1
      if (correct) domainEntry.correct += 1
      domainScoreMap.set(domainId, domainEntry)

      const objEntry = objectiveOutcomes.get(q.objectiveId) ?? { correct: 0, total: 0 }
      objEntry.total += 1
      if (correct) objEntry.correct += 1
      objectiveOutcomes.set(q.objectiveId, objEntry)
    })

    const elapsedSeconds = Math.min(
      session.durationMinutes * 60,
      Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    )
    const scaledScore = scaleScore(correctCount, questions.length)

    const resultId = await db.examResults.add({
      certId,
      date: new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      totalQuestions: questions.length,
      correctCount,
      scaledScore,
      passed: scaledScore >= examMeta.passingScore,
      domainScores: Array.from(domainScoreMap.values()),
    })

    await db.quizAttempts.bulkAdd(
      questions.map((q) => {
        const answer = session.answers[q.id] ?? emptyResponse(q)
        return {
          certId,
          objectiveId: q.objectiveId,
          questionId: q.id,
          correct: isQuestionCorrect(q, answer),
          response: answer,
          mode: 'exam' as const,
          timestamp: new Date().toISOString(),
          examResultId: resultId as number,
        }
      }),
    )

    for (const [objectiveId, outcome] of objectiveOutcomes) {
      const existing = await db.userProgress.get([certId, objectiveId])
      const updated = applySm2Update(
        existing ?? createInitialProgress(certId, objectiveId),
        outcome.correct,
        outcome.total,
      )
      await db.userProgress.put(updated)
    }

    clearExamSession(certId)
    navigate(`/${certId}/exam/results/${resultId}`)
  }

  const answeredCount = questions.filter((q) => hasAnswer(session.answers[q.id] ?? emptyResponse(q))).length
  const previousLocked = index > 0 && lockedSet.has(questions[index - 1].id)

  return (
    <div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          Répondu : {answeredCount} / {questions.length}
        </span>
        <span className={`timer ${remaining < 300 ? 'low' : ''}`}>{formatTime(remaining)}</span>
      </div>

      <div className="qnav">
        {questions.map((q, i) => {
          const answered = hasAnswer(session.answers[q.id] ?? emptyResponse(q))
          const locked = lockedSet.has(q.id)
          const cls = ['', answered ? 'answered' : '', i === index ? 'current' : ''].filter(Boolean).join(' ')
          return (
            <button
              key={q.id}
              className={cls}
              disabled={locked && i !== index}
              title={locked ? 'Verrouillée (solution/objectif) — non révisable' : undefined}
              style={locked ? { opacity: 0.4, textDecoration: 'line-through' } : undefined}
              onClick={() => goToIndex(i)}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {current?.type === 'solution-goal' && !lockedSet.has(current.id) && (
        <div className="chip warn" style={{ marginBottom: '0.75rem' }}>
          ⚠️ Une fois passé à la question suivante, tu ne pourras plus revenir sur celle-ci — comme dans le vrai
          examen.
        </div>
      )}

      {current && (
        <QuestionRenderer
          question={current}
          caseStudy={caseStudy}
          response={currentResponse}
          displayChoices={display.choices}
          onToggleChoice={toggleChoice}
          onReorder={reorder}
          onSetField={setField}
          revealed={false}
          questionNumber={index + 1}
          totalQuestions={questions.length}
        />
      )}

      <div className="btn-row">
        <button className="btn secondary" disabled={index === 0 || previousLocked} onClick={() => goToIndex(index - 1)}>
          ← Précédent
        </button>
        <button className="btn secondary" disabled={index + 1 >= questions.length} onClick={() => goToIndex(index + 1)}>
          Suivant →
        </button>
        <button className="btn" onClick={() => void handleSubmit()} disabled={submitting}>
          Terminer l'examen
        </button>
      </div>
    </div>
  )
}
