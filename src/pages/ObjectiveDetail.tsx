import { Link, useParams } from 'react-router-dom'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import RichText, { renderInline } from '../components/RichText'
import Diagram from '../components/Diagram'

export default function ObjectiveDetail() {
  const certId = useCertId()
  const { objectivesById, domainsById, lessonByObjective, questionsByObjective, labsByObjective } =
    getCertContent(certId)!
  const { objectiveId } = useParams<{ objectiveId: string }>()
  const objective = objectiveId ? objectivesById[objectiveId] : undefined
  const lesson = objectiveId ? lessonByObjective[objectiveId] : undefined
  const questionCount = objectiveId ? questionsByObjective[objectiveId]?.length ?? 0 : 0
  const labs = objectiveId ? labsByObjective[objectiveId] ?? [] : []

  if (!objective || !lesson) {
    return <p>Objectif introuvable.</p>
  }

  const domain = domainsById[objective.domainId]
  const diagrams = lesson.diagrams ?? []

  return (
    <div>
      <div className="breadcrumb">
        <Link to={`/${certId}/domains`}>Domaines</Link> ·{' '}
        <Link to={`/${certId}/domains/${objective.domainId}`}>{domain?.name}</Link>
      </div>

      <h1>{objective.title}</h1>
      <div className="chip-row" style={{ marginBottom: '1.25rem' }}>
        <span className="chip accent">{domain?.name}</span>
        <span className="chip">{questionCount} questions</span>
        {diagrams.length > 0 && <span className="chip">{diagrams.length} schéma{diagrams.length > 1 ? 's' : ''}</span>}
      </div>

      <div className="callout definition">
        <div className="callout-label">📘 Définition</div>
        <RichText as="p" text={lesson.summary} />
      </div>

      {diagrams.length > 0 && (
        <>
          <div className="section-title">
            <span className="si">🧭</span> Schémas
          </div>
          {diagrams.map((d) => (
            <Diagram key={d} id={d} />
          ))}
        </>
      )}

      <div className="section-title">
        <span className="si">🔑</span> Points clés
      </div>
      <ul className="keypoints">
        {lesson.keyPoints.map((point, i) => (
          <li key={i}>{renderInline(point)}</li>
        ))}
      </ul>

      <div className="section-title">
        <span className="si">⚠️</span> Pièges fréquents
      </div>
      <ul className="trap-list">
        {lesson.commonPitfalls.map((pitfall, i) => (
          <li key={i}>{renderInline(pitfall)}</li>
        ))}
      </ul>

      {lesson.commands && lesson.commands.length > 0 && (
        <>
          <div className="section-title">
            <span className="si">⌨️</span> Commandes clés
          </div>
          <p className="muted" style={{ marginTop: '-0.25rem' }}>
            L'examen teste la syntaxe exacte — Azure CLI et PowerShell sont tous deux au programme.
          </p>
          {lesson.commands.map((cmd, i) => (
            <div key={i} className="cmd-item">
              <div className="cmd-task">{renderInline(cmd.task)}</div>
              {cmd.cli && (
                <code className="cmd-block" data-shell="az cli">
                  {cmd.cli}
                </code>
              )}
              {cmd.powershell && (
                <code className="cmd-block" data-shell="pwsh">
                  {cmd.powershell}
                </code>
              )}
            </div>
          ))}
        </>
      )}

      <div className="section-title">
        <span className="si">🎯</span> Compétences officielles (Microsoft Learn)
      </div>
      <div className="card">
        <ul className="skill-list">
          {objective.officialSkills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </div>

      <div className="section-title">
        <span className="si">🔗</span> Pour aller plus loin
      </div>
      <ul className="link-list">
        {lesson.learnLinks.map((link) => (
          <li key={link}>
            <a href={link} target="_blank" rel="noreferrer">
              {link}
            </a>
          </li>
        ))}
      </ul>

      {labs.length > 0 && (
        <>
          <div className="section-title">
            <span className="si">🧪</span> Labs pratiques
          </div>
          <div className="card">
            <ul>
              {labs.map((lab) => (
                <li key={lab.id}>
                  <Link to={`/${certId}/labs`}>{lab.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="section-title">
        <span className="si">▶</span> Réviser en quiz
      </div>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {questionCount} questions disponibles. Chaque session tire un sous-ensemble au hasard, avec l'ordre des
          réponses mélangé — le quiz est différent à chaque passage.
        </p>
        <div className="btn-row">
          {[10, 20].map((n) =>
            n < questionCount ? (
              <Link key={n} to={`/${certId}/objectives/${objective.id}/quiz?n=${n}`} className="btn secondary">
                Quiz de {n}
              </Link>
            ) : null,
          )}
          <Link to={`/${certId}/objectives/${objective.id}/quiz?n=${questionCount}`} className="btn">
            Tout réviser ({questionCount})
          </Link>
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: '0.5rem' }}>
        <Link to={`/${certId}/domains/${objective.domainId}`} className="btn secondary">
          ← Retour au domaine
        </Link>
      </div>
    </div>
  )
}
