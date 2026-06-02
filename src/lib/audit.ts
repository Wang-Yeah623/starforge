export type AuditItem = {
  id: string
  label: string
  passed: boolean
  points: number
  maxPoints: number
  fix: string
}

export type AuditReport = {
  projectName: string
  score: number
  grade: 'Launch-ready' | 'Promising' | 'Needs polish'
  summary: string
  items: AuditItem[]
  checklist: string[]
}

export type ProjectInput = {
  projectName?: string
  readme?: string
  packageJson?: Record<string, unknown>
}

const rules: Array<{
  id: string
  label: string
  maxPoints: number
  test: (input: Required<ProjectInput>) => boolean
  fix: string
}> = [
  {
    id: 'sharp-positioning',
    label: 'README opens with a clear one-sentence promise',
    maxPoints: 14,
    test: ({ readme }) => /^# .+\n+.{35,220}/m.test(readme.trim()),
    fix: 'Add a short, concrete promise under the H1: who it helps and what it does.',
  },
  {
    id: 'quickstart',
    label: 'Quickstart is visible and copy-pasteable',
    maxPoints: 14,
    test: ({ readme }) => /quick ?start|getting started|installation/i.test(readme) && /```/.test(readme),
    fix: 'Add a Quickstart section with install and run commands in fenced code blocks.',
  },
  {
    id: 'demo',
    label: 'Demo or screenshot is present',
    maxPoints: 12,
    test: ({ readme }) => /!\[.+\]\(.+\)|demo|screenshot|preview/i.test(readme),
    fix: 'Add a screenshot, GIF, hosted demo, or terminal output preview near the top.',
  },
  {
    id: 'use-cases',
    label: 'Use cases are easy to scan',
    maxPoints: 10,
    test: ({ readme }) => /use cases|why|features|what you can do/i.test(readme),
    fix: 'Add 3-5 bullets that map the project to real developer problems.',
  },
  {
    id: 'license',
    label: 'License is declared',
    maxPoints: 9,
    test: ({ readme, packageJson }) => Boolean(packageJson.license) || /license/i.test(readme),
    fix: 'Add an MIT, Apache-2.0, or project-appropriate license file and README section.',
  },
  {
    id: 'contributing',
    label: 'Contributing path is welcoming',
    maxPoints: 8,
    test: ({ readme }) => /contribut|good first issue|roadmap/i.test(readme),
    fix: 'Add a short contributing section, roadmap, or issue labels to invite help.',
  },
  {
    id: 'automation',
    label: 'Quality automation is mentioned',
    maxPoints: 8,
    test: ({ readme, packageJson }) =>
      /test|lint|ci|github actions/i.test(readme) ||
      Boolean((packageJson.scripts as Record<string, unknown> | undefined)?.test),
    fix: 'Expose test, lint, and build commands so contributors trust the repo quickly.',
  },
  {
    id: 'metadata',
    label: 'Package metadata helps discovery',
    maxPoints: 8,
    test: ({ packageJson }) =>
      Array.isArray(packageJson.keywords) &&
      packageJson.keywords.length >= 4 &&
      typeof packageJson.description === 'string',
    fix: 'Add a precise description and at least four searchable keywords.',
  },
  {
    id: 'social-proof',
    label: 'Social sharing copy exists',
    maxPoints: 7,
    test: ({ readme }) => /launch|share|tweet|post|hacker news|product hunt/i.test(readme),
    fix: 'Include a launch post template or short shareable project description.',
  },
  {
    id: 'roadmap',
    label: 'Roadmap shows momentum',
    maxPoints: 10,
    test: ({ readme }) => /roadmap|next|planned|future/i.test(readme),
    fix: 'Add a tiny roadmap with near-term improvements people can imagine joining.',
  },
]

export function auditProject(input: ProjectInput): AuditReport {
  const project: Required<ProjectInput> = {
    projectName: input.projectName || 'Untitled project',
    readme: input.readme || '',
    packageJson: input.packageJson || {},
  }

  const items = rules.map((rule) => {
    const passed = rule.test(project)
    return {
      id: rule.id,
      label: rule.label,
      passed,
      points: passed ? rule.maxPoints : 0,
      maxPoints: rule.maxPoints,
      fix: rule.fix,
    }
  })

  const score = Math.round(
    (items.reduce((total, item) => total + item.points, 0) /
      items.reduce((total, item) => total + item.maxPoints, 0)) *
      100,
  )

  const grade =
    score >= 82 ? 'Launch-ready' : score >= 58 ? 'Promising' : 'Needs polish'

  return {
    projectName: project.projectName,
    score,
    grade,
    summary: makeSummary(score, items),
    items,
    checklist: items
      .filter((item) => !item.passed)
      .slice(0, 5)
      .map((item) => item.fix),
  }
}

export function renderChecklist(report: AuditReport): string {
  const fixes =
    report.checklist.length > 0
      ? report.checklist.map((item) => `- [ ] ${item}`)
      : ['- [x] No launch blockers found. Keep the repo fresh and share it.']

  const lines = [
    `# ${report.projectName} launch checklist`,
    '',
    `Star-readiness score: ${report.score}/100 (${report.grade})`,
    '',
    '## Fix next',
    ...fixes,
    '',
    '## Passed',
    ...report.items
      .filter((item) => item.passed)
      .map((item) => `- [x] ${item.label} (+${item.points})`),
    '',
  ]

  return lines.join('\n')
}

function makeSummary(score: number, items: AuditItem[]) {
  const misses = items.filter((item) => !item.passed).length

  if (score >= 82) {
    return `Strong launch shape. Only ${misses} signal${misses === 1 ? '' : 's'} need attention before sharing widely.`
  }

  if (score >= 58) {
    return `Good foundation. Fix the highest-signal README and launch gaps before asking strangers for attention.`
  }

  return `The project needs clearer positioning before launch. Start with the README promise, quickstart, and demo.`
}
