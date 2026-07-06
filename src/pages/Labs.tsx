import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import type { LabProgress } from '../types'

export default function Labs() {
  const certId = useCertId()
  const { domains, objectivesByDomain, labsByObjective } = getCertContent(certId)!
  const progress = useLiveQuery(
    () => db.labProgress.where('certId').equals(certId).toArray(),
    [certId],
    [] as LabProgress[],
  )
  const progressByLab = new Map(progress?.map((p) => [p.labId, p]))

  async function toggle(labId: string) {
    const existing = progressByLab.get(labId)
    const completed = !existing?.completed
    await db.labProgress.put({
      certId,
      labId,
      completed,
      completedAt: completed ? new Date().toISOString() : null,
    })
  }

  const totalLabs = domains
    .flatMap((d) => objectivesByDomain[d.id] ?? [])
    .flatMap((o) => labsByObjective[o.id] ?? []).length
  const completedLabs = progress?.filter((p) => p.completed).length ?? 0
  const labPct = totalLabs > 0 ? Math.round((completedLabs / totalLabs) * 100) : 0

  return (
    <div>
      <h1>Labs pratiques</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Ces scénarios se réalisent sur ton propre tenant Azure, via portal.azure.com. Coche-les au fur et à mesure.
      </p>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <strong>Progression des labs</strong>
          <span className="muted">
            {completedLabs} / {totalLabs}
          </span>
        </div>
        <div className="progress-bar">
          <div style={{ width: `${labPct}%` }} />
        </div>
      </div>

      {domains.map((domain) => {
        const objs = objectivesByDomain[domain.id] ?? []
        const labs = objs.flatMap((o) => labsByObjective[o.id] ?? [])
        if (labs.length === 0) return null
        return (
          <div key={domain.id}>
            <div className="section-title">{domain.name}</div>
            {labs.map((lab) => {
              const done = progressByLab.get(lab.id)?.completed ?? false
              return (
                <div key={lab.id} className={`lab-item ${done ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    className="lab-check"
                    checked={done}
                    onChange={() => toggle(lab.id)}
                    aria-label={`Marquer ${lab.title} comme complété`}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ textDecoration: done ? 'line-through' : 'none' }}>{lab.title}</strong>
                    <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                      {lab.description}
                    </p>
                    <ol>
                      {lab.azurePortalSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    <a href={lab.portalUrl} target="_blank" rel="noreferrer">
                      Ouvrir dans le portail Azure →
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
