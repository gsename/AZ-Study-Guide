import type { ExamMeta } from '../content/registry'

/** One decimal, with the comma this French UI uses everywhere else. */
function pct1(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

/** Whole days from now until `iso`, negative once it has passed. */
function daysUntil(iso: string, now: Date = new Date()): number | null {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

/**
 * Formats the CALENDAR date as declared, without converting to the viewer's
 * timezone.
 *
 * `toLocaleDateString` would be wrong here: AZ-500's retirement is stored as
 * `2026-08-31T23:59:00-06:00`, and in a UTC+2 locale that renders as
 * "1 septembre" — a day of reprieve that does not exist. Microsoft says
 * August 31, so August 31 is what a learner must read, wherever they are.
 */
function formatDeclaredDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  const [, year, month, day] = match
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ]
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`
}

/**
 * Two notices the learner needs before trusting anything else on the page, both
 * driven by `examMeta` rather than by a `certId` test — so a certification added
 * later declares its own state instead of inheriting someone else's.
 *
 *   retirement   a countdown, because "2026-08-31" does not read as urgent while
 *                "27 days" does. Rendered only while a date is in the future or
 *                recently past; a retired certification says so plainly.
 *
 *   reliability  what a candidate scores on this bank by always picking the
 *                longest option. When that figure nears the raw pass mark, a mock
 *                score here is inflated, and a learner calibrating readiness
 *                against it is being misled. This is the honest mitigation when
 *                the items cannot be fixed in the time available.
 */
export default function ExamMetaNotices({ examMeta }: Readonly<{ examMeta: ExamMeta }>) {
  const days = examMeta.retirementDate ? daysUntil(examMeta.retirementDate) : null
  const retiring = days !== null && days <= 400
  const alreadyRetired = days !== null && days <= 0
  const status = examMeta.bankStatus

  // The raw fraction the pass mark corresponds to — the bar the free score is
  // compared against. 700/1000 is 70.0%.
  const rawPassPercent = (examMeta.passingScore / examMeta.scoreMax) * 100
  // Two tiers, because 69.5% against a 70% bar and 50.1% against it are not the
  // same problem and must not read as though they were. `severe` means a
  // candidate who reads nothing is within a few points of passing.
  const leaks = status ? status.freeScorePercent > rawPassPercent - 20 : false
  const severe = status ? status.freeScorePercent > rawPassPercent - 5 : false

  if (!retiring && !leaks) return null

  return (
    <>
      {retiring && (
        <div className="notice bad">
          <strong>
            {alreadyRetired
              ? 'Cette certification est retirée.'
              : `Cette certification est retirée dans ${days} jour${days === 1 ? '' : 's'}.`}
          </strong>{' '}
          {alreadyRetired ? (
            <>
              {examMeta.code} ne peut plus être obtenu ni renouvelé. Cette banque reste consultable comme
              support de révision technique, pas comme préparation à un examen.
            </>
          ) : (
            <>
              Microsoft retire {examMeta.code}, son examen et ses évaluations de renouvellement le{' '}
              {formatDeclaredDate(examMeta.retirementDate)}. Après cette date, la certification ne peut
              plus être obtenue ni renouvelée.
            </>
          )}
        </div>
      )}

      {leaks && status && (
        <div className={severe ? 'notice warn' : 'notice'}>
          <strong>
            {severe
              ? "Les scores d'examen blanc sur cette banque sont surévalués."
              : "Interprète les scores d'examen blanc avec prudence."}
          </strong>{' '}
          Un candidat qui coche systématiquement l'option la plus longue, sans rien lire, obtient{' '}
          <strong>{pct1(status.freeScorePercent)}&nbsp;%</strong> sur cette banque — contre{' '}
          {pct1(rawPassPercent)}&nbsp;% de bonnes réponses nécessaires pour réussir. Mesuré le{' '}
          {status.measuredOn} par <code>npm run check:bank</code>.{' '}
          {severe
            ? 'Un score obtenu ici ne dit donc pas grand-chose de ta préparation réelle : sers-toi des questions pour apprendre et des explications pour comprendre, pas du pourcentage pour te rassurer.'
            : "L'écart au seuil reste confortable, mais une partie de ton score vient de la forme des questions plutôt que de tes connaissances."}
          {!status.referentialVerified && (
            <>
              {' '}
              Le référentiel de cette certification n'a pas non plus été vérifié contre le study guide
              officiel.
            </>
          )}
        </div>
      )}
    </>
  )
}
