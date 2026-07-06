import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import { latestAccuracy } from '../lib/spacedRepetition'
import type { UserProgress } from '../types'

export default function DomainsList() {
  const certId = useCertId()
  const { domains, objectivesByDomain, examMeta } = getCertContent(certId)!
  const progressList = useLiveQuery(
    () => db.userProgress.where('certId').equals(certId).toArray(),
    [certId],
    [] as UserProgress[],
  )
  const progressByObjective = new Map(progressList?.map((p) => [p.objectiveId, p]))

  return (
    <div>
      <h1>Domaines</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Les {domains.length} domaines officiels de l'examen {examMeta.code}, avec leur pondération et ta progression
        estimée.
      </p>
      <div className="grid grid-2">
        {domains.map((domain) => {
          const objs = objectivesByDomain[domain.id] ?? []
          const accuracies = objs.map((o) => latestAccuracy(progressByObjective.get(o.id)) ?? 0)
          const avg =
            accuracies.length > 0 ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : 0
          return (
            <Link key={domain.id} to={`/${certId}/domains/${domain.id}`} className="card-link">
              <div className="card" style={{ marginBottom: 0, height: '100%' }}>
                <div className="chip-row" style={{ marginBottom: '0.6rem' }}>
                  <span className="chip accent">
                    {domain.weightPercent.min}-{domain.weightPercent.max}%
                  </span>
                  <span className="chip">{objs.length} objectifs</span>
                </div>
                <h2 style={{ marginTop: 0, fontSize: '1.15rem' }}>{domain.name}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Progression
                  </span>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {Math.round(avg * 100)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div style={{ width: `${Math.round(avg * 100)}%` }} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
