import { useNavigate } from 'react-router-dom'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import { buildExam } from '../lib/examBuilder'
import { saveExamSession, DEFAULT_EXAM_QUESTION_COUNT } from '../lib/examSession'

export default function ExamStart() {
  const certId = useCertId()
  const { domains, objectivesByDomain, questionsByObjective, examMeta } = getCertContent(certId)!
  const navigate = useNavigate()

  function start() {
    const exam = buildExam(domains, objectivesByDomain, questionsByObjective, DEFAULT_EXAM_QUESTION_COUNT)
    saveExamSession(certId, {
      questionIds: exam.map((q) => q.id),
      startedAt: new Date().toISOString(),
      durationMinutes: examMeta.durationMinutes,
      answers: {},
      lockedQuestionIds: [],
    })
    navigate(`/${certId}/exam/session`)
  }

  return (
    <div>
      <h1>Examen blanc</h1>
      <div className="card">
        <div className="chip-row" style={{ marginBottom: '1rem' }}>
          <span className="chip accent">{DEFAULT_EXAM_QUESTION_COUNT} questions</span>
          <span className="chip">{examMeta.durationMinutes} min</span>
          <span className="chip">
            Réussite {examMeta.passingScore}/{examMeta.scoreMax}
          </span>
        </div>
        <p>
          Les questions sont tirées <strong>proportionnellement à la pondération officielle</strong> des{' '}
          {domains.length} domaines :
        </p>
        <div className="grid" style={{ margin: '0.75rem 0' }}>
          {domains.map((d) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span>{d.name}</span>
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                {d.weightPercent.min}-{d.weightPercent.max}%
              </span>
            </div>
          ))}
        </div>
        <p className="muted">
          Le chronomètre ne s'arrête pas une fois lancé. Tu peux naviguer entre les questions et changer tes réponses
          avant de terminer — sauf pour les questions de type « solution proposée / objectif atteint ? », où, comme
          dans le vrai examen, tu ne peux plus revenir en arrière une fois passé à la question suivante.
        </p>
        <p className="muted">
          Mix de formats pour t'entraîner à leur logique (QCM simple/multiple, étude de cas, réordonnancement,
          active screen, séquences solution/objectif) — <strong>pas une reconstitution fidèle</strong> de la vraie
          répartition, que Microsoft ne publie pas.
        </p>
        <button className="btn" onClick={start}>
          ▶ Commencer l'examen
        </button>
      </div>
    </div>
  )
}
