import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCertContent } from '../content/registry'
import { useCertId } from '../certifications'
import {
  allocateByWeight,
  buildExam,
  constraintCount,
  domainWeightMidpoint,
} from '../lib/examBuilder'
import { saveExamSession, examLengthOptions, defaultExamLength } from '../lib/examSession'
import ExamMetaNotices from '../components/ExamMetaNotices'

export default function ExamStart() {
  const certId = useCertId()
  const { domains, objectivesByDomain, questionsByObjective, examMeta } = getCertContent(certId)!
  const navigate = useNavigate()

  // Lengths come from the referential's declared item count rather than a
  // hardcoded constant, so a certification that publishes a different range gets
  // the right choices without a code change.
  const lengths = examLengthOptions(examMeta.questionCountRange)
  const [count, setCount] = useState(() => defaultExamLength(examMeta.questionCountRange))

  // Shown per domain so the weighting is verifiable rather than asserted.
  const allocation = allocateByWeight(domains.map(domainWeightMidpoint), count)

  // The draw now shapes composition on a second axis, so the page has to say so:
  // otherwise it describes a weighting it no longer governs on its own.
  const constraintShare = examMeta.constraintShare?.percent ?? 0
  const constraintQuestions = constraintCount(
    domains,
    objectivesByDomain,
    questionsByObjective,
    count,
    constraintShare,
  )

  function start() {
    const exam = buildExam(
      domains,
      objectivesByDomain,
      questionsByObjective,
      count,
      constraintShare,
    )
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

      <ExamMetaNotices examMeta={examMeta} />

      <div className="card">
        <div className="chip-row" style={{ marginBottom: '1rem' }}>
          <span className="chip accent">{count} questions</span>
          <span className="chip">{examMeta.durationMinutes} min</span>
          <span className="chip">
            Réussite {examMeta.passingScore}/{examMeta.scoreMax}
          </span>
        </div>

        {lengths.length > 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <div className="build-col-title">Longueur</div>
            <div className="chip-row">
              {lengths.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`statement-pick${n === count ? ' picked' : ''}`}
                  aria-pressed={n === count}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
              {examMeta.questionCountRangeSource
                ? `Fourchette ${examMeta.questionCountRange} — ${examMeta.questionCountRangeSource}`
                : `D'après la fourchette annoncée de ${examMeta.questionCountRange} questions.`}
            </p>
          </div>
        )}

        <p>
          Les questions sont tirées <strong>proportionnellement à la pondération officielle</strong> des{' '}
          {domains.length} domaines :
        </p>
        <div className="grid" style={{ margin: '0.75rem 0' }}>
          {domains.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span>{d.name}</span>
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                {d.weightPercent.min}-{d.weightPercent.max}% · {allocation[i]} question
                {allocation[i] === 1 ? '' : 's'}
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
          Les questions d'une même étude de cas sont présentées <strong>à la suite</strong>, comme dans le vrai
          examen : le scénario n'est à lire qu'une fois.
        </p>
        {constraintQuestions > 0 && (
          <p className="muted">
            <strong>
              {constraintQuestions} question{constraintQuestions === 1 ? '' : 's'} sur {count}
            </strong>{' '}
            se départage{constraintQuestions === 1 ? '' : 'nt'} sur une contrainte — plusieurs options
            fonctionnent et une seule respecte le privilège minimum, le coût le plus bas ou la couverture la
            plus large. La cible de {constraintShare}&nbsp;% vient d'un comptage sur deux évaluations
            d'entraînement, <strong>pas d'un chiffre publié par Microsoft</strong> : elle est indicative, à la
            différence de la pondération par domaine ci-dessus.
          </p>
        )}
        <p className="muted">
          Mix de formats pour t'entraîner à leur logique (QCM simple/multiple, étude de cas, réordonnancement,
          active screen, grille Oui/Non, glisser-déposer, phrase à compléter, construction de liste, séquences
          solution/objectif) — <strong>pas une reconstitution fidèle</strong> de la vraie répartition, que
          Microsoft ne publie pas.
        </p>
        <button className="btn" onClick={start}>
          ▶ Commencer l'examen
        </button>
      </div>
    </div>
  )
}
