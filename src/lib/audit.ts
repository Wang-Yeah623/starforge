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
  /** Whether a dedicated LICENSE file exists in the repo root. */
  hasLicenseFile?: boolean
  /** Whether a CONTRIBUTING file exists in the repo root. */
  hasContributingFile?: boolean
  /** Whether continuous integration is configured (e.g. .github/workflows). */
  hasCi?: boolean
  /** Whether a changelog file exists. */
  hasChangelog?: boolean
  /** Whether the repo ships issue or pull request templates. */
  hasIssueTemplates?: boolean
}

type ResolvedInput = Required<ProjectInput>

const rules: Array<{
  id: string
  label: string
  maxPoints: number
  test: (input: ResolvedInput) => boolean
  fix: string
}> = [
  {
    id: 'sharp-positioning',
    label: 'README opens with a clear one-sentence promise',
    maxPoints: 12,
    test: ({ readme }) => /^# .+\n+.{35,220}/m.test(readme.trim()),
    fix: 'Add a short, concrete promise under the H1: who it helps and what it does.',
  },
  {
    id: 'quickstart',
    label: 'Quickstart is visible and copy-pasteable',
    maxPoints: 12,
    test: ({ readme }) => /quick ?start|getting started|installation/i.test(readme) && /```/.test(readme),
    fix: 'Add a Quickstart section with install and run commands in fenced code blocks.',
  },
  {
    id: 'demo',
    label: 'Demo or screenshot is present',
    maxPoints: 11,
    test: ({ readme }) => /!\[.+\]\(.+\)|demo|screenshot|preview/i.test(readme),
    fix: 'Add a screenshot, GIF, hosted demo, or terminal output preview near the top.',
  },
  {
    id: 'use-cases',
    label: 'Use cases are easy to scan',
    maxPoints: 9,
    test: ({ readme }) => /use cases|why|features|what you can do/i.test(readme),
    fix: 'Add 3-5 bullets that map the project to real developer problems.',
  },
  {
    id: 'license',
    label: 'License is declared',
    maxPoints: 8,
    test: ({ readme, packageJson, hasLicenseFile }) =>
      hasLicenseFile || Boolean(packageJson.license) || /license/i.test(readme),
    fix: 'Add an MIT, Apache-2.0, or project-appropriate LICENSE file and README section.',
  },
  {
    id: 'contributing',
    label: 'Contributing path is welcoming',
    maxPoints: 7,
    test: ({ readme, hasContributingFile }) =>
      hasContributingFile || /contribut|good first issue|roadmap/i.test(readme),
    fix: 'Add a CONTRIBUTING file or README section, roadmap, or issue labels to invite help.',
  },
  {
    id: 'automation',
    label: 'Quality automation is mentioned',
    maxPoints: 7,
    test: ({ readme, packageJson, hasCi }) =>
      hasCi ||
      /test|lint|ci|github actions/i.test(readme) ||
      Boolean((packageJson.scripts as Record<string, unknown> | undefined)?.test),
    fix: 'Expose test, lint, and build commands and add a CI workflow so contributors trust the repo.',
  },
  {
    id: 'metadata',
    label: 'Package metadata helps discovery',
    maxPoints: 7,
    test: ({ packageJson }) =>
      Array.isArray(packageJson.keywords) &&
      packageJson.keywords.length >= 4 &&
      typeof packageJson.description === 'string',
    fix: 'Add a precise description and at least four searchable keywords.',
  },
  {
    id: 'badges',
    label: 'Badges signal health at a glance',
    maxPoints: 6,
    test: ({ readme }) => /!\[[^\]]*\]\(https:\/\/img\.shields\.io|badge|\[!\[/i.test(readme),
    fix: 'Add CI, license, and version badges near the top so health is obvious in one glance.',
  },
  {
    id: 'social-proof',
    label: 'Social sharing copy exists',
    maxPoints: 6,
    test: ({ readme }) => /launch|share|tweet|post|hacker news|product hunt/i.test(readme),
    fix: 'Include a launch post template or short shareable project description.',
  },
  {
    id: 'roadmap',
    label: 'Roadmap shows momentum',
    maxPoints: 8,
    test: ({ readme }) => /roadmap|next|planned|future/i.test(readme),
    fix: 'Add a tiny roadmap with near-term improvements people can imagine joining.',
  },
  {
    id: 'changelog',
    label: 'Changelog tracks progress',
    maxPoints: 4,
    test: ({ readme, hasChangelog }) => hasChangelog || /changelog|release notes/i.test(readme),
    fix: 'Add a CHANGELOG so returning visitors can see the project is actively maintained.',
  },
  {
    id: 'community-templates',
    label: 'Issue and PR templates lower friction',
    maxPoints: 3,
    test: ({ hasIssueTemplates }) => hasIssueTemplates,
    fix: 'Add issue and pull request templates under .github to guide first-time contributors.',
  },
]

function resolveInput(input: ProjectInput): ResolvedInput {
  return {
    projectName: input.projectName || 'Untitled project',
    readme: input.readme || '',
    packageJson: input.packageJson || {},
    hasLicenseFile: input.hasLicenseFile ?? false,
    hasContributingFile: input.hasContributingFile ?? false,
    hasCi: input.hasCi ?? false,
    hasChangelog: input.hasChangelog ?? false,
    hasIssueTemplates: input.hasIssueTemplates ?? false,
  }
}

export function auditProject(input: ProjectInput): AuditReport {
  const project = resolveInput(input)

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
      .slice(0, 6)
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

/**
 * Generate copy-pasteable shields.io badges based on the audited metadata.
 */
export function generateBadges(input: ProjectInput): string[] {
  const project = resolveInput(input)
  const slug = encodeURIComponent(project.projectName)
  const license =
    typeof project.packageJson.license === 'string' ? project.packageJson.license : 'MIT'
  const badges = [
    `![CI](https://img.shields.io/badge/CI-passing-2f7a49)`,
    `![License](https://img.shields.io/badge/license-${encodeURIComponent(license)}-blue)`,
  ]

  if (typeof project.packageJson.version === 'string') {
    badges.push(
      `![Version](https://img.shields.io/badge/version-${encodeURIComponent(
        project.packageJson.version,
      )}-d6a844)`,
    )
  }

  badges.push(`![Stars](https://img.shields.io/github/stars/owner/${slug}?style=social)`)
  return badges
}

/**
 * Generate a short, shareable launch post tailored to the audited project.
 */
export function generateLaunchPost(report: AuditReport, input: ProjectInput): string {
  const project = resolveInput(input)
  const description =
    typeof project.packageJson.description === 'string'
      ? project.packageJson.description
      : 'a project worth a look'

  const topFix = report.checklist[0]
  const closer =
    report.grade === 'Launch-ready'
      ? 'It is launch-ready, feedback welcome.'
      : topFix
        ? `Next up: ${topFix.replace(/\.$/, '')}.`
        : 'Early but moving fast.'

  return [
    `I built ${project.projectName}: ${description}`,
    '',
    `Star-readiness score: ${report.score}/100 (${report.grade}). ${closer}`,
    '',
    'Try it and let me know what you think.',
  ].join('\n')
}

function makeSummary(score: number, items: AuditItem[]) {
  const misses = items.filter((item) => !item.passed).length

  if (score >= 82) {
    return `Strong launch shape. Only ${misses} signal${misses === 1 ? ' needs' : 's need'} attention before sharing widely.`
  }

  if (score >= 58) {
    return `Good foundation. Fix the highest-signal README and launch gaps before asking strangers for attention.`
  }

  return `The project needs clearer positioning before launch. Start with the README promise, quickstart, and demo.`
}
