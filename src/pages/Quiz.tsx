import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import { shuffle, seededShuffle } from '../lib/examBuilder'
import { emptyResponse, hasAnswer, isQuestionCorrect } from '../lib/grading'
import { applySm2Update, createInitialProgress } from '../lib/spacedRepetition'
import { db } from '../db'
import QuestionRenderer from '../components/QuestionRenderer'
import type { QuestionResponse, QuizQuestion } from '../types'

const DEFAULT_QUIZ_SIZE = 20

interface PreparedQuestion {
  question: QuizQuestion
  displayChoices?: string[]
  initialOrder?: string[]
}

function prepareQuestion(question: QuizQuestion, salt: string): PreparedQuestion {
  if (question.type === 'reorder') {
    return { question, initialOrder: shuffle(question.reorderItems ?? []) }
  }
  if (question.type === 'active-screen') {
    return { question }
  }
  return { question, displayChoices: seededShuffle(question.choices ?? [], `${question.id}:${salt}`) }
}

function initialResponseFor(prepared: PreparedQuestion): QuestionResponse {
  if (prepared.question.type === 'reorder') {
    return { kind: 'order', order: prepared.initialOrder ?? [] }
  }
  return emptyResponse(prepared.question)
}

export default function Quiz() {
  const certId = useCertId()
  const { objectivesById, questionsByObjective, caseStudiesById } = getCertContent(certId)!
  const { objectiveId } = useParams<{ objectiveId: string }>()
  const [searchParams] = useSearchParams()
  const objective = objectiveId ? objectivesById[objectiveId] : undefined

  const pool = objectiveId ? questionsByObjective[objectiveId] ?? [] : []
  const requested = Number(searchParams.get('n'))
  const size = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_QUIZ_SIZE
  const targetSize = Math.min(size, pool.length)

  // A salt fixed for the session: keeps question selection AND choice/order
  // stable across re-renders, but changes on restart for a fresh draw.
  const [salt, setSalt] = useState(() => Math.random().toString(36).slice(2))

  const prepared: PreparedQuestion[] = useMemo(() => {
    const picked = shuffle(pool).slice(0, targetSize)
    return picked.map((q) => prepareQuestion(q, salt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectiveId, salt, targetSize])

  const [index, setIndex] = useState(0)
  const [response, setResponse] = useState<QuestionResponse>(() => (prepared[0] ? initialResponseFor(prepared[0]) : { kind: 'choices', selected: [] }))
  const [revealed, setRevealed] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!objective) return <p>Objectif introuvable.</p>
  if (prepared.length === 0) return <p>Aucune question disponible pour cet objectif.</p>

  const current = prepared[index]
  const caseStudy = current.question.caseStudyId ? caseStudiesById[current.question.caseStudyId] : null

  function toggleChoice(choice: string) {
    if (revealed) return
    setResponse((prev) => {
      if (prev.kind !== 'choices') return prev
      if (current.question.type === 'multiple') {
        const selected = prev.selected.includes(choice)
          ? prev.selected.filter((c) => c !== choice)
          : [...prev.selected, choice]
        return { kind: 'choices', selected }
      }
      return { kind: 'choices', selected: [choice] }
    })
  }

  function reorder(order: string[]) {
    if (revealed) return
    setResponse({ kind: 'order', order })
  }

  function setField(fieldId: string, value: string) {
    if (revealed) return
    setResponse((prev) => {
      const values = prev.kind === 'fields' ? prev.values : {}
      return { kind: 'fields', values: { ...values, [fieldId]: value } }
    })
  }

  async function handleValidate() {
    const correct = isQuestionCorrect(current.question, response)
    if (correct) setCorrectCount((c) => c + 1)
    setRevealed(true)
    await db.quizAttempts.add({
      certId,
      objectiveId: objective!.id,
      questionId: current.question.id,
      correct,
      mode: 'practice',
      timestamp: new Date().toISOString(),
    })
  }

  async function handleNext() {
    if (index + 1 < prepared.length) {
      const nextIndex = index + 1
      setIndex(nextIndex)
      setResponse(initialResponseFor(prepared[nextIndex]))
      setRevealed(false)
    } else {
      setFinished(true)
      if (!saved) {
        setSaved(true)
        const existing = await db.userProgress.get([certId, objective!.id])
        const updated = applySm2Update(
          existing ?? createInitialProgress(certId, objective!.id),
          correctCount,
          prepared.length,
        )
        await db.userProgress.put(updated)
      }
    }
  }

  function restart() {
    setSalt(Math.random().toString(36).slice(2))
    setIndex(0)
    setRevealed(false)
    setCorrectCount(0)
    setFinished(false)
    setSaved(false)
  }

  if (finished) {
    const accuracy = Math.round((correctCount / prepared.length) * 100)
    const tone = accuracy >= 75 ? 'good' : accuracy >= 60 ? 'warn' : 'bad'
    return (
      <div>
        <div className="breadcrumb">
          <Link to={`/${certId}/objectives/${objective.id}`}>← {objective.title}</Link>
        </div>
        <h1>Résultat</h1>
        <div className="card">
          <div className="stat-row">
            <div className="big-score" style={{ color: `var(--${tone})` }}>
              {accuracy}%
            </div>
            <div>
              <p style={{ margin: 0 }}>
                <strong>{correctCount}</strong> / {prepared.length} bonnes réponses
              </p>
              <p className="muted" style={{ margin: '0.3rem 0 0' }}>
                La prochaine date de révision de cet objectif a été mise à jour (répétition espacée SM-2).
              </p>
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={restart}>
            🔁 Nouveau tirage
          </button>
          <Link to={`/${certId}/objectives/${objective.id}`} className="btn secondary">
            Retour à l'objectif
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="breadcrumb">
        <Link to={`/${certId}/objectives/${objective.id}`}>← {objective.title}</Link>
      </div>
      <QuestionRenderer
        question={current.question}
        caseStudy={caseStudy}
        response={response}
        displayChoices={current.displayChoices}
        onToggleChoice={toggleChoice}
        onReorder={reorder}
        onSetField={setField}
        revealed={revealed}
        questionNumber={index + 1}
        totalQuestions={prepared.length}
      />
      {!revealed ? (
        <button className="btn" disabled={!hasAnswer(response)} onClick={handleValidate}>
          Valider
        </button>
      ) : (
        <button className="btn" onClick={handleNext}>
          {index + 1 < prepared.length ? 'Question suivante →' : 'Voir le résultat'}
        </button>
      )}
    </div>
  )
}
