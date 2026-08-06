import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'

export default function ExamResult() {
  const certId = useCertId()
  const { domainsById, examMeta } = getCertContent(certId)!
  const { resultId } = useParams<{ resultId: string }>()
  const id = resultId ? Number(resultId) : undefined
  const result = useLiveQuery(() => (id ? db.examResults.get(id) : undefined), [id])

  if (result === undefined) return <p className="muted">Chargement…</p>
  if (!result) return <p>Résultat introuvable.</p>

  return (
    <div>
      <h1>Résultat de l'examen blanc</h1>

      <div className="card">
        <div className="stat-row">
          <div className="big-score" style={{ color: result.passed ? 'var(--good)' : 'var(--bad)' }}>
            {result.scaledScore}
            <span style={{ fontSize: '1.1rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              {' '}
              / {examMeta.scoreMax}
            </span>
          </div>
          <div>
            <span className={`chip ${result.passed ? 'good' : 'bad'}`}>
              {result.passed ? '✓ Réussi' : '✕ Échoué'}
            </span>
            <p className="muted" style={{ margin: '0.5rem 0 0' }}>
              Seuil {examMeta.passingScore}/{examMeta.scoreMax} · {result.correctCount}/{result.totalQuestions} bonnes
              réponses · durée {Math.round(result.durationSeconds / 60)} min
            </p>
          </div>
        </div>

        {/* The caveat belongs HERE, next to the number, not only in the README:
            the score is computed linearly and looks exactly like a real Microsoft
            scaled score, which is the thing that makes it misleading. */}
        <p className="muted" style={{ margin: '1rem 0 0', fontSize: '0.85rem' }}>
          <strong>Ce score est une approximation.</strong> Il est calculé linéairement
          ({result.correctCount}/{result.totalQuestions} ={' '}
          {Math.round((result.correctCount / result.totalQuestions) * 100)} % ×{' '}
          {examMeta.scoreMax}), ce qui place le seuil de {examMeta.passingScore} à exactement{' '}
          {Math.round((examMeta.passingScore / examMeta.scoreMax) * 1000) / 10} % de bonnes réponses. La
          notation réelle de Microsoft repose sur la théorie de réponse à l'item : chaque question est
          pondérée par sa difficulté, donc le même taux brut ne donne pas le même score selon la forme
          d'examen tirée. Un score juste au-dessus du seuil ici ne garantit rien le jour de l'examen.
        </p>
      </div>

      <div className="card">
        <h2>Détail par domaine</h2>
        <p className="muted" style={{ margin: '0 0 1rem', fontSize: '0.85rem' }}>
          Indicatif seulement : sur un vrai rapport de score Microsoft, seul le score total décide de la
          réussite, et les barres par domaine servent à orienter la révision. Avec {result.totalQuestions}{' '}
          questions réparties sur {result.domainScores.length} domaines, quelques questions suffisent à faire
          bouger un pourcentage de domaine.
        </p>
        {result.domainScores.map((ds) => {
          const domain = domainsById[ds.domainId]
          const p = ds.total > 0 ? Math.round((ds.correct / ds.total) * 100) : 0
          return (
            <div key={ds.domainId} style={{ marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.3rem' }}>
                <span>{domain?.name ?? ds.domainId}</span>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                  {ds.correct}/{ds.total} · {p}%
                </span>
              </div>
              <div className="progress-bar">
                <div style={{ width: `${p}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="btn-row">
        <Link to={`/${certId}/exam`} className="btn">
          🔁 Nouvel examen blanc
        </Link>
        <Link to={`/${certId}`} className="btn secondary">
          Retour au dashboard
        </Link>
      </div>
    </div>
  )
}
