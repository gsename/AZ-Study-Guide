import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import { shuffle } from '../lib/examBuilder'
import { hasAnswer, isQuestionCorrect } from '../lib/grading'
import {
  DEFAULT_QUIZ_SIZE,
  initialResponseFor,
  prepareQuestion,
  type PreparedQuestion,
} from '../lib/quizSession'
import { loadReviewSelection } from '../lib/reviewSession'
import { applySm2Update, createInitialProgress } from '../lib/spacedRepetition'
import { db } from '../db'
import QuestionRenderer from '../components/QuestionRenderer'
import type { QuestionResponse, QuizQuestion } from '../types'

export default function Quiz() {
  const certId = useCertId()
  const { objectivesById, questionsByObjective, questionsById, caseStudiesById } =
    getCertContent(certId)!
  const { objectiveId } = useParams<{ objectiveId: string }>()
  const [searchParams] = useSearchParams()
  const objective = objectiveId ? objectivesById[objectiveId] : undefined

  // Two sources, one loop. Without `objectiveId` in the route this is a review
  // replay drawing from the queue the learner just filtered, which spans several
  // objectives — hence the per-question `objectiveId` when recording attempts
  // below, rather than the page's.
  const reviewMode = !objectiveId
  const pool: QuizQuestion[] = reviewMode
    ? loadReviewSelection(certId)
        .map((id) => questionsById[id])
        .filter((q): q is QuizQuestion => Boolean(q))
    : questionsByObjective[objectiveId] ?? []

  const requested = Number(searchParams.get('n'))
  const size = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_QUIZ_SIZE
  // A replay covers the whole selection: capping it at the default quiz size
  // would silently drop items the learner explicitly chose to revisit.
  const targetSize = reviewMode ? pool.length : Math.min(size, pool.length)

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

  // Navigating between objectives keeps this component mounted, so `prepared`
  // is recomputed while `index` survives. Arriving from a longer objective left
  // `index` past the end of the new set, `prepared[index]` was undefined, and
  // reading `.question` off it crashed the page on a perfectly valid route.
  useEffect(() => {
    setIndex(0)
    setRevealed(false)
    setCorrectCount(0)
    setFinished(false)
    setSaved(false)
    if (prepared[0]) setResponse(initialResponseFor(prepared[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectiveId, targetSize])

  if (!reviewMode && !objective) return <p>Objectif introuvable.</p>
  if (prepared.length === 0)
    return reviewMode ? (
      <div>
        <h1>Rejeu</h1>
        <p className="muted">
          Aucune question sélectionnée. Reviens sur <Link to={`/${certId}/review`}>À revoir</Link> pour en
          choisir.
        </p>
      </div>
    ) : (
      <p>Aucune question disponible pour cet objectif.</p>
    )

  // Clamped as well as reset: the effect above runs after render, so the first
  // render following a navigation would still index out of bounds.
  const current = prepared[Math.min(index, prepared.length - 1)]
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
      // The question's own objective, not the page's: a review replay spans
      // several. Identical to `objective.id` in per-objective mode.
      objectiveId: current.question.objectiveId,
      questionId: current.question.id,
      correct,
      response,
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
      // A review replay deliberately over-samples what the learner got wrong, so
      // feeding its accuracy into SM-2 would push the objective's next review
      // date out on the basis of an unrepresentative set. The attempts are still
      // recorded — which is what removes the items from the queue — but the
      // schedule is left to the per-objective quizzes and mock exams that sample
      // fairly.
      if (!saved && !reviewMode && objective) {
        setSaved(true)
        const existing = await db.userProgress.get([certId, objective.id])
        const updated = applySm2Update(
          existing ?? createInitialProgress(certId, objective.id),
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

  const breadcrumb = reviewMode ? (
    <div className="breadcrumb">
      <Link to={`/${certId}/review`}>← À revoir</Link>
    </div>
  ) : (
    <div className="breadcrumb">
      <Link to={`/${certId}/objectives/${objective!.id}`}>← {objective!.title}</Link>
    </div>
  )

  if (finished) {
    const accuracy = Math.round((correctCount / prepared.length) * 100)
    const tone = accuracy >= 75 ? 'good' : accuracy >= 60 ? 'warn' : 'bad'
    return (
      <div>
        {breadcrumb}
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
                {reviewMode
                  ? "Les questions réussies ont quitté la liste « À revoir ». La date de révision de l'objectif n'est pas modifiée : un rejeu ne tire que tes erreurs, ce n'est donc pas un échantillon représentatif."
                  : 'La prochaine date de révision de cet objectif a été mise à jour (répétition espacée SM-2).'}
              </p>
            </div>
          </div>
        </div>
        <div className="btn-row">
          {reviewMode ? (
            <Link to={`/${certId}/review`} className="btn">
              Retour à « À revoir »
            </Link>
          ) : (
            <>
              <button className="btn" onClick={restart}>
                🔁 Nouveau tirage
              </button>
              <Link to={`/${certId}/objectives/${objective!.id}`} className="btn secondary">
                Retour à l'objectif
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {breadcrumb}
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
