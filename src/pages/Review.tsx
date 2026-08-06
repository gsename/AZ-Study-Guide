import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import { describeCorrectAnswer, describeResponse } from '../lib/grading'
import { buildReviewQueue, queueQuestionIds } from '../lib/reviewQueue'
import { saveReviewSelection } from '../lib/reviewSession'
import { renderInline } from '../components/RichText'
import type { UserProgress } from '../types'

const ALL = '__all__'

export default function Review() {
  const certId = useCertId()
  const { questionsById, objectivesById, objectives, domainsById } = getCertContent(certId)!
  const [objectiveFilter, setObjectiveFilter] = useState(ALL)
  const [skillFilter, setSkillFilter] = useState(ALL)

  const attempts = useLiveQuery(
    () => db.quizAttempts.where('certId').equals(certId).toArray(),
    [certId],
  )
  const progress = useLiveQuery(
    () => db.userProgress.where('certId').equals(certId).toArray(),
    [certId],
  )

  const queue = useMemo(() => {
    if (!attempts || !progress) return null
    const byObjective = new Map<string, UserProgress>(progress.map((p) => [p.objectiveId, p]))
    return buildReviewQueue(attempts, questionsById, byObjective)
  }, [attempts, progress, questionsById])

  if (queue === null) return <p className="muted">Chargement…</p>

  const filtered = queue.filter(
    ({ question }) =>
      (objectiveFilter === ALL || question.objectiveId === objectiveFilter) &&
      (skillFilter === ALL || question.skillRef === skillFilter),
  )

  // Only offer filters that would actually return something.
  const objectivesPresent = objectives.filter((o) => queue.some((e) => e.question.objectiveId === o.id))
  const skillsPresent = [...new Set(queue.map((e) => e.question.skillRef).filter(Boolean))].sort()

  function startReplay() {
    saveReviewSelection(certId, queueQuestionIds(filtered))
  }

  return (
    <div>
      <h1>À revoir</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Les questions dont la <strong>dernière</strong> réponse était fausse. Répondre juste à l'une
        d'elles la retire de cette liste — c'est ce qui fait que le compteur veut dire quelque chose.
      </p>

      {queue.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Rien à revoir. Fais un quiz ou un examen blanc : les questions ratées apparaîtront ici avec ta
            réponse à côté de la bonne.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="chip-row" style={{ marginBottom: '0.9rem' }}>
              <span className="chip accent">{filtered.length} à revoir</span>
              {queue.some((e) => e.overdue) && (
                <span className="chip warn">
                  {queue.filter((e) => e.overdue).length} sur un objectif en retard de révision
                </span>
              )}
            </div>

            <div className="review-filters">
              <label>
                <span className="build-col-title">Objectif</span>
                <select
                  className="sentence-select"
                  value={objectiveFilter}
                  onChange={(e) => setObjectiveFilter(e.target.value)}
                >
                  <option value={ALL}>Tous ({queue.length})</option>
                  {objectivesPresent.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} — {o.title.slice(0, 60)} (
                      {queue.filter((e) => e.question.objectiveId === o.id).length})
                    </option>
                  ))}
                </select>
              </label>

              {skillsPresent.length > 0 && (
                <label>
                  <span className="build-col-title">Compétence officielle</span>
                  <select
                    className="sentence-select"
                    value={skillFilter}
                    onChange={(e) => setSkillFilter(e.target.value)}
                  >
                    <option value={ALL}>Toutes</option>
                    {skillsPresent.map((ref) => (
                      <option key={ref} value={ref}>
                        {ref} ({queue.filter((e) => e.question.skillRef === ref).length})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {filtered.length > 0 && (
              <Link to={`/${certId}/review/quiz`} className="btn" onClick={startReplay}>
                ▶ Rejouer ces {filtered.length} question{filtered.length === 1 ? '' : 's'}
              </Link>
            )}
          </div>

          {filtered.map(({ question, attempt, overdue }) => {
            const objective = objectivesById[question.objectiveId]
            const domain = objective ? domainsById[objective.domainId] : undefined
            const given = describeResponse(question, attempt.response)
            const expected = describeCorrectAnswer(question)
            return (
              <div className="card" key={question.id}>
                <div className="chip-row" style={{ marginBottom: '0.6rem' }}>
                  {domain && <span className="chip">{domain.name}</span>}
                  <span className="chip">{question.objectiveId}</span>
                  {question.skillRef && <span className="chip">{question.skillRef}</span>}
                  <span className={`badge ${question.difficulty}`}>{question.difficulty}</span>
                  <span className="chip">{attempt.mode === 'exam' ? 'examen blanc' : 'quiz'}</span>
                  {overdue && <span className="chip warn">révision en retard</span>}
                </div>

                <p style={{ marginTop: 0 }}>{renderInline(question.prompt)}</p>

                <div className="review-answers">
                  <div className="review-answer bad">
                    <div className="build-col-title">Ta réponse</div>
                    {given.length === 0 ? (
                      <p className="muted" style={{ margin: 0 }}>
                        Non enregistrée — tentative antérieure à l'ajout de cette fonctionnalité.
                      </p>
                    ) : (
                      <ul>
                        {given.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="review-answer good">
                    <div className="build-col-title">Réponse attendue</div>
                    <ul>
                      {expected.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="explanation-box">
                  <strong>💡 Explication</strong>
                  <p style={{ margin: '0.4rem 0 0' }}>{renderInline(question.explanation)}</p>
                </div>

                <Link
                  to={`/${certId}/objectives/${question.objectiveId}`}
                  className="btn secondary"
                  style={{ marginTop: '0.8rem' }}
                >
                  Revoir la fiche de cours
                </Link>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
