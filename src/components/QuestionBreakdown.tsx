import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { describeCorrectAnswer, describeResponse } from '../lib/grading'
import { renderInline } from './RichText'
import type { CaseStudy, Domain, Objective, QuestionResponse, QuizQuestion } from '../types'

/**
 * One question, corrected: what you answered, what was expected, and why.
 *
 * Extracted from `Review.tsx`, which had this inline, because the exam result
 * page needs exactly the same thing — and a second copy would have been the
 * place where the two drifted apart. `describeResponse` and
 * `describeCorrectAnswer` in `src/lib/grading.ts` already render all three
 * response shapes (`choices` / `order` / `fields`), so nothing here knows about
 * item types.
 *
 * `caseStudy` matters more than it looks: 13% of the bank is grouped, and a
 * grouped stem reads "Referring to requirement 3 (…)". Without its scenario the
 * correction of those questions is unreadable, which would quietly make the
 * hardest questions the ones you cannot review.
 */
export default function QuestionBreakdown({
  certId,
  question,
  response,
  correct,
  caseStudy,
  domain,
  objective,
  chips,
}: {
  certId: string
  question: QuizQuestion
  response: QuestionResponse | undefined
  correct: boolean
  caseStudy?: CaseStudy
  domain?: Domain
  objective?: Objective
  chips?: ReactNode
}) {
  const given = describeResponse(question, response)
  const expected = describeCorrectAnswer(question)

  return (
    <div className="card">
      <div className="chip-row" style={{ marginBottom: '0.6rem' }}>
        <span className={`chip ${correct ? 'good' : 'bad'}`}>{correct ? '✓ Juste' : '✕ Faux'}</span>
        {domain && <span className="chip">{domain.name}</span>}
        <span className="chip">{objective?.title ?? question.objectiveId}</span>
        {question.skillRef && <span className="chip">{question.skillRef}</span>}
        <span className={`badge ${question.difficulty}`}>{question.difficulty}</span>
        {/* Worth surfacing: these are the questions where several options work and
            only one respects the stated constraint, which is the shape that cost
            the most marks on the real practice assessments. */}
        {question.decision && <span className="chip warn">départagée par une contrainte</span>}
        {chips}
      </div>

      {caseStudy && (
        <div className="case-study-box">
          <strong>📄 {caseStudy.title}</strong>
          {'\n'}
          {caseStudy.scenario}
        </div>
      )}

      <p style={{ marginTop: 0 }}>{renderInline(question.prompt)}</p>

      <div className="review-answers">
        <div className={`review-answer ${correct ? 'good' : 'bad'}`}>
          <div className="build-col-title">Ta réponse</div>
          {given.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Aucune réponse enregistrée — question laissée vide, ou tentative antérieure à l'ajout de
              cette fonctionnalité.
            </p>
          ) : (
            <ul>
              {given.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
        {/* Repeating the expected answer next to a correct one is noise, so it
            only appears when the two actually differ. */}
        {!correct && (
          <div className="review-answer good">
            <div className="build-col-title">Réponse attendue</div>
            <ul>
              {expected.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="explanation-box">
        <strong>💡 Explication</strong>
        <p style={{ margin: '0.4rem 0 0' }}>{renderInline(question.explanation)}</p>
      </div>

      <div className="btn-row" style={{ marginTop: '0.8rem' }}>
        <Link to={`/${certId}/objectives/${question.objectiveId}`} className="btn secondary">
          Revoir la fiche de cours
        </Link>
        {question.src?.startsWith('http') && (
          <a href={question.src} target="_blank" rel="noreferrer" className="btn secondary">
            Source Microsoft Learn ↗
          </a>
        )}
      </div>
    </div>
  )
}
