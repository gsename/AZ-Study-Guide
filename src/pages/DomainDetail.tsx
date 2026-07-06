import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import { latestAccuracy, isOverdue } from '../lib/spacedRepetition'
import type { UserProgress } from '../types'

export default function DomainDetail() {
  const certId = useCertId()
  const { domainsById, objectivesByDomain, questionsByObjective } = getCertContent(certId)!
  const { domainId } = useParams<{ domainId: string }>()
  const domain = domainId ? domainsById[domainId] : undefined
  const objectives = domainId ? objectivesByDomain[domainId] ?? [] : []
  const progressList = useLiveQuery(
    () => db.userProgress.where('certId').equals(certId).toArray(),
    [certId],
    [] as UserProgress[],
  )
  const progressByObjective = new Map(progressList?.map((p) => [p.objectiveId, p]))

  if (!domain) {
    return <p>Domaine introuvable.</p>
  }

  return (
    <div>
      <div className="breadcrumb">
        <Link to={`/${certId}/domains`}>Domaines</Link>
      </div>
      <h1>{domain.name}</h1>
      <div className="chip-row" style={{ marginBottom: '1.25rem' }}>
        <span className="chip accent">
          Poids officiel {domain.weightPercent.min}-{domain.weightPercent.max}%
        </span>
        <span className="chip">{objectives.length} objectifs</span>
      </div>

      <div className="grid">
        {objectives.map((objective) => {
          const progress = progressByObjective.get(objective.id)
          const acc = latestAccuracy(progress)
          const overdue = isOverdue(progress)
          const questionCount = questionsByObjective[objective.id]?.length ?? 0
          return (
            <Link key={objective.id} to={`/${certId}/objectives/${objective.id}`} className="card-link">
              <div className="card" style={{ marginBottom: 0 }}>
                <h3 style={{ marginTop: 0 }}>{objective.title}</h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  {objective.description}
                </p>
                <div className="chip-row">
                  {acc === null ? (
                    <span className="chip warn">Jamais révisé</span>
                  ) : (
                    <span className={`chip ${acc >= 0.75 ? 'good' : acc >= 0.6 ? 'warn' : 'bad'}`}>
                      Dernier score : {Math.round(acc * 100)}%
                    </span>
                  )}
                  {overdue && <span className="chip bad">Révision en retard</span>}
                  <span className="chip">{questionCount} questions</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
