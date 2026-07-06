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
  passingScore: number
  scoreMax: number
  durationMinutes: number
  questionCountRange: string
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
