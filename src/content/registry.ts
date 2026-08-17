import type {
  Domain,
  Objective,
  LessonContent,
  QuizQuestion,
  CaseStudy,
  LabReference,
} from '../types'

export interface ExamMeta {
  code: string
  name: string
  certification: string
  skillsMeasuredAsOf: string
  retirementDate: string
  /** Where the retirement date comes from, quoted, so it is auditable. */
  retirementSource?: string
  passingScore: number
  scoreMax: number
  durationMinutes: number
  questionCountRange: string
  /**
   * Where `questionCountRange` comes from. Microsoft no longer publishes item
   * counts, so for recent exams this is an estimate and the UI must not present
   * it as an official figure.
   */
  questionCountRangeSource?: string
  studyGuideUrl?: string
  /** When the domains, weights and `officialSkills` were last diffed against the guide. */
  outlineVerifiedOn?: string
  /** What the vendor actually says about item formats, quoted. */
  itemFormatNote?: string
  /** What the vendor says about GA vs Preview coverage, quoted. */
  contentCurrencyNote?: string
  /**
   * The honest state of this certification's question bank, rendered to the
   * learner rather than kept in the README.
   *
   * `freeScorePercent` is the figure `npm run check:bank` prints: what a
   * candidate scores by always picking the longest option, which is the one
   * authoring tell that survives runtime choice-shuffling. When it approaches the
   * raw pass mark, a mock score on this bank is inflated and the learner is
   * calibrating their readiness against a number that flatters them. Saying so is
   * the honest mitigation when there is not time to fix the items.
   *
   * Declared per certification instead of testing `certId` inside a page, so the
   * next certification added does not silently inherit another one's caveat.
   */
  bankStatus?: {
    /** Has the referential been diffed against the official study guide? */
    referentialVerified: boolean
    /** Percentage, as printed by check-bank.mjs. */
    freeScorePercent: number
    /** When that figure was measured — it moves as the bank is remediated. */
    measuredOn: string
  }
  /**
   * What share of a drawn mock exam must be decided by a CONSTRAINT — an item
   * where several options do the job and only one respects "least privilege" or
   * "minimize cost". `buildExam` reserves this share inside each domain's
   * allocation, so the published domain weighting is untouched.
   *
   * Unlike `passingScore` or the domain weights, this figure is NOT published by
   * the vendor: it is measured off practice assessments, so `source` must say so
   * and the UI must not present it as official. Same treatment as
   * `questionCountRangeSource`. Omit it and the draw behaves as it always did.
   */
  constraintShare?: {
    /** Percentage of each domain's allocation reserved for constraint items. */
    percent: number
    /** Where the figure comes from, stated plainly enough to be audited. */
    source: string
    /** When it was counted — recount if the exam's own style shifts. */
    measuredOn: string
  }
}

export interface CertContent {
  certId: string
  examMeta: ExamMeta
  domains: Domain[]
  objectives: Objective[]
  lessons: LessonContent[]
  questions: QuizQuestion[]
  caseStudies: CaseStudy[]
  labs: LabReference[]
  domainsById: Record<string, Domain>
  objectivesByDomain: Record<string, Objective[]>
  objectivesById: Record<string, Objective>
  lessonByObjective: Record<string, LessonContent>
  questionsByObjective: Record<string, QuizQuestion[]>
  questionsById: Record<string, QuizQuestion>
  caseStudiesById: Record<string, CaseStudy>
  labsByObjective: Record<string, LabReference[]>
}

interface Referential {
  exam: ExamMeta
  domains: Domain[]
  objectives: Objective[]
}

// Eagerly bundles every certification's content. Adding a certification is
// just adding a `src/content/<certId>/` folder with the same shape — no code
// change needed here.
const domainsModules = import.meta.glob<{ default: Referential }>('./*/domains.json', {
  eager: true,
})
const caseStudiesModules = import.meta.glob<{ default: CaseStudy[] }>('./*/case-studies.json', {
  eager: true,
})
const labsModules = import.meta.glob<{ default: LabReference[] }>('./*/labs.json', {
  eager: true,
})
const lessonsModules = import.meta.glob<{ default: LessonContent[] }>('./*/lessons/*.json', {
  eager: true,
})
const quizModules = import.meta.glob<{ default: QuizQuestion[] }>('./*/quiz/*.json', {
  eager: true,
})

function certIdFromPath(path: string): string {
  // path looks like './az500/domains.json' or './az500/lessons/domain-1.json'
  return path.split('/')[1]
}

function groupByCertId<T>(modules: Record<string, { default: T }>): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  for (const [path, mod] of Object.entries(modules)) {
    const certId = certIdFromPath(path)
    grouped[certId] ??= []
    grouped[certId].push(mod.default)
  }
  return grouped
}

const lessonsByCertId = groupByCertId(lessonsModules)
const quizByCertId = groupByCertId(quizModules)

function buildCertContent(certId: string, referential: Referential): CertContent {
  const domains = referential.domains
  const objectives = referential.objectives
  const lessons = (lessonsByCertId[certId] ?? []).flat()
  const questions = (quizByCertId[certId] ?? []).flat()
  const caseStudies = caseStudiesModules[`./${certId}/case-studies.json`]?.default ?? []
  const labs = labsModules[`./${certId}/labs.json`]?.default ?? []

  const domainsById = Object.fromEntries(domains.map((d) => [d.id, d]))
  const objectivesByDomain = Object.fromEntries(
    domains.map((d) => [d.id, objectives.filter((o) => o.domainId === d.id)]),
  )
  const objectivesById = Object.fromEntries(objectives.map((o) => [o.id, o]))
  const lessonByObjective = Object.fromEntries(lessons.map((l) => [l.objectiveId, l]))
  const questionsByObjective = Object.fromEntries(
    objectives.map((o) => [o.id, questions.filter((q) => q.objectiveId === o.id)]),
  )
  const questionsById = Object.fromEntries(questions.map((q) => [q.id, q]))
  const caseStudiesById = Object.fromEntries(caseStudies.map((c) => [c.id, c]))
  const labsByObjective = Object.fromEntries(
    objectives.map((o) => [o.id, labs.filter((l) => l.objectiveId === o.id)]),
  )

  return {
    certId,
    examMeta: referential.exam,
    domains,
    objectives,
    lessons,
    questions,
    caseStudies,
    labs,
    domainsById,
    objectivesByDomain,
    objectivesById,
    lessonByObjective,
    questionsByObjective,
    questionsById,
    caseStudiesById,
    labsByObjective,
  }
}

const certContentById: Record<string, CertContent> = Object.fromEntries(
  Object.entries(domainsModules).map(([path, mod]) => {
    const certId = certIdFromPath(path)
    return [certId, buildCertContent(certId, mod.default)]
  }),
)

export const certIds: string[] = Object.keys(certContentById).sort()

export function getCertContent(certId: string): CertContent | undefined {
  return certContentById[certId]
}
