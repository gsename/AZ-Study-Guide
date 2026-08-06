import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import { domainWeightMidpoint } from '../lib/examBuilder'
import { buildReviewQueue } from '../lib/reviewQueue'
import ExamMetaNotices from '../components/ExamMetaNotices'
import { isOverdue, latestAccuracy } from '../lib/spacedRepetition'
import type { UserProgress } from '../types'

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export default function Dashboard() {
  const certId = useCertId()
  const content = getCertContent(certId)!
  const { domains, objectives, objectivesByDomain, domainsById, examMeta, questionsById } = content

  const progressList = useLiveQuery(
    () => db.userProgress.where('certId').equals(certId).toArray(),
    [certId],
    [] as UserProgress[],
  )
  const recentExams = useLiveQuery(
    async () => {
      const all = await db.examResults.where('certId').equals(certId).toArray()
      return all.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
    },
    [certId],
    [],
  )

  const attempts = useLiveQuery(
    () => db.quizAttempts.where('certId').equals(certId).toArray(),
    [certId],
    [],
  )

  const progressByObjective = new Map(progressList?.map((p) => [p.objectiveId, p]))

  // Built with the same function the review page uses, so the count on the
  // dashboard and the list behind it can never disagree.
  const reviewQueue = buildReviewQueue(attempts ?? [], questionsById, progressByObjective)

  const domainStats = domains.map((domain) => {
    const objs = objectivesByDomain[domain.id] ?? []
    const accuracies = objs.map((o) => latestAccuracy(progressByObjective.get(o.id)) ?? 0)
    const avg = accuracies.length > 0 ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : 0
    return { domain, avg }
  })

  const totalWeight = domainStats.reduce((s, d) => s + domainWeightMidpoint(d.domain), 0)
  const overall =
    totalWeight > 0
      ? domainStats.reduce((s, d) => s + d.avg * domainWeightMidpoint(d.domain), 0) / totalWeight
      : 0

  const reviewedCount = objectives.filter((o) => latestAccuracy(progressByObjective.get(o.id)) !== null).length

  const atRisk = objectives
    .map((o) => ({ objective: o, progress: progressByObjective.get(o.id) }))
    .filter(({ progress }) => {
      if (!progress) return true
      const acc = latestAccuracy(progress)
      return (acc !== null && acc < 0.6) || isOverdue(progress)
    })

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Prépare l'examen {examMeta.code} — {examMeta.durationMinutes} min · réussite à {examMeta.passingScore}/
        {examMeta.scoreMax}.
      </p>

      <ExamMetaNotices examMeta={examMeta} />

      <div className="card">
        <div className="stat-row">
          <div
            className="ring"
            style={{ ['--pct' as string]: Math.round(overall * 100) }}
          >
            <div className="ring-label">
              <div className="ring-value">{pct(overall)}</div>
              <div className="ring-sub">maîtrise</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ marginTop: 0 }}>Progression globale</h2>
            <p className="muted">
              Estimation pondérée par le poids officiel de chaque domaine. {reviewedCount} / {objectives.length}{' '}
              objectifs déjà révisés.
            </p>
            <div className="btn-row">
              <Link to={`/${certId}/domains`} className="btn">
                Réviser un objectif
              </Link>
              <Link to={`/${certId}/exam`} className="btn secondary">
                Lancer un examen blanc
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Par domaine</h2>
        {domainStats.map(({ domain, avg }) => (
          <div key={domain.id} style={{ marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.3rem' }}>
              <Link to={`/${certId}/domains/${domain.id}`}>{domain.name}</Link>
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                {pct(avg)} · {domain.weightPercent.min}-{domain.weightPercent.max}%
              </span>
            </div>
            <div className="progress-bar">
              <div style={{ width: pct(avg) }} />
            </div>
          </div>
        ))}
      </div>

      {reviewQueue.length > 0 && (
        <div className="card">
          <h2>🔁 À revoir</h2>
          <div className="stat-row">
            <div className="big-score" style={{ color: 'var(--bad)' }}>
              {reviewQueue.length}
            </div>
            <div>
              <p style={{ margin: 0 }}>
                question{reviewQueue.length === 1 ? '' : 's'} dont la dernière réponse était fausse
                {reviewQueue.filter((e) => e.overdue).length > 0 &&
                  `, dont ${reviewQueue.filter((e) => e.overdue).length} sur un objectif en retard`}
                .
              </p>
              <p className="muted" style={{ margin: '0.3rem 0 0' }}>
                Répondre juste à une question la retire de la liste.
              </p>
            </div>
          </div>
          <Link to={`/${certId}/review`} className="btn" style={{ marginTop: '0.8rem' }}>
            Ouvrir la liste
          </Link>
        </div>
      )}

      <div className="card">
        <h2>⚠️ Objectifs à risque</h2>
        {atRisk.length === 0 ? (
          <p className="muted">Aucun objectif à risque — bon travail.</p>
        ) : (
          <div className="grid">
            {atRisk.map(({ objective, progress }) => {
              const acc = latestAccuracy(progress)
              const domain = domainsById[objective.domainId]
              let reason = 'Jamais révisé'
              let tone = 'warn'
              if (progress && acc !== null && acc < 0.6) {
                reason = `Dernier score : ${pct(acc)}`
                tone = 'bad'
              } else if (progress && isOverdue(progress)) {
                reason = 'Révision en retard'
                tone = 'warn'
              }
              return (
                <Link key={objective.id} to={`/${certId}/objectives/${objective.id}`} className="card-link">
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="chip-row" style={{ marginBottom: '0.4rem' }}>
                      <span className={`chip ${tone}`}>{reason}</span>
                      <span className="chip">{domain?.name}</span>
                    </div>
                    <strong>{objective.title}</strong>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2>📝 Examens blancs récents</h2>
        {!recentExams || recentExams.length === 0 ? (
          <p className="muted">Aucun examen blanc passé pour le moment.</p>
        ) : (
          <table className="scores">
            <thead>
              <tr>
                <th>Date</th>
                <th>Score</th>
                <th>Résultat</th>
              </tr>
            </thead>
            <tbody>
              {recentExams.map((exam) => (
                <tr key={exam.id}>
                  <td>{new Date(exam.date).toLocaleString()}</td>
                  <td>
                    <Link to={`/${certId}/exam/results/${exam.id}`}>
                      {exam.scaledScore} / {examMeta.scoreMax}
                    </Link>
                  </td>
                  <td>
                    <span className={`chip ${exam.passed ? 'good' : 'bad'}`}>
                      {exam.passed ? 'Réussi' : 'Échoué'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
