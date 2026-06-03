import type {
  AuditCategory,
  AuditItem,
  AuditReport,
  CategoryScore,
  Grade,
  RepoSnapshot,
} from './types'

// Each rule inspects a normalized snapshot and decides whether a real,
// stranger-visible signal is present. Rules check actual files, git activity,
// and package metadata -- not just whether a keyword appears in the README.
type Rule = {
  id: string
  category: AuditCategory
  label: string
  maxPoints: number
  evaluate: (snapshot: RepoSnapshot) => { passed: boolean; detail?: string }
  fix: string
}

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  'first-impression': 'First impression',
  runnability: 'Runnability',
  trust: 'Trust & quality',
  growth: 'Growth & community',
}

const RECENCY_WINDOW_DAYS = 180

function readmeText(snapshot: RepoSnapshot): string {
  return snapshot.readme?.text ?? ''
}

function basenameOf(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] ?? path
}

function hasFile(snapshot: RepoSnapshot, matcher: RegExp): boolean {
  return snapshot.files.some((file) => matcher.test(file))
}

function hasBasename(snapshot: RepoSnapshot, matcher: RegExp): boolean {
  return snapshot.files.some((file) => matcher.test(basenameOf(file)))
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

const rules: Rule[] = [
  {
    id: 'positioning',
    category: 'first-impression',
    label: 'README opens with a clear one-sentence promise',
    maxPoints: 12,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot).trim()
      if (!text) return { passed: false, detail: 'No README found.' }
      const lines = text.split(/\r?\n/)
      const h1Index = lines.findIndex((line) => /^#\s+\S/.test(line))
      if (h1Index === -1) return { passed: false, detail: 'No top-level H1 heading.' }

      for (let i = h1Index + 1; i < Math.min(lines.length, h1Index + 8); i += 1) {
        const line = lines[i].trim()
        if (!line) continue
        if (/^!\[/.test(line) || /^<img/i.test(line)) continue
        if (/shields\.io|img\.shields|badge/i.test(line)) continue
        if (/^#{1,6}\s/.test(line)) break
        const plain = line.replace(/[*_`>#[\]()]/g, '').trim()
        if (plain.length >= 40 && plain.length <= 260) {
          return { passed: true, detail: truncate(plain, 96) }
        }
        return {
          passed: false,
          detail: 'First line under the title is too short to explain the project.',
        }
      }
      return { passed: false, detail: 'No description under the title.' }
    },
    fix: 'Add one concrete sentence right under the H1: who it helps and what it does.',
  },
  {
    id: 'quickstart',
    category: 'runnability',
    label: 'Quickstart is visible and copy-pasteable',
    maxPoints: 12,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot)
      const hasHeading =
        /(^|\n)#{1,6}\s.*(install|quick ?start|getting started|usage|setup|run)\b/i.test(text)
      const hasFence = /```/.test(text)
      if (hasHeading && hasFence) return { passed: true }
      if (hasFence) return { passed: false, detail: 'Has code blocks but no install/usage heading.' }
      return { passed: false, detail: 'No fenced command block found.' }
    },
    fix: 'Add an Install/Quickstart section with copy-pasteable commands in a fenced code block.',
  },
  {
    id: 'visual-demo',
    category: 'first-impression',
    label: 'A demo, screenshot, or preview is present',
    maxPoints: 9,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot)
      const images = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1])
      const htmlImg = /<img\s[^>]*src=["']?([^"'>\s]+)/i.exec(text)?.[1]
      const candidates = [...images, htmlImg].filter(Boolean) as string[]
      const realImage = candidates.find((src) => !/shields\.io|img\.shields|badge/i.test(src))
      if (realImage) return { passed: true, detail: truncate(realImage, 60) }

      const demoLink = /\b(live demo|demo|playground|try it online|screencast|video)\b/i.test(text)
      if (demoLink) return { passed: true, detail: 'Demo / video link in README.' }

      const asset = hasFile(snapshot, /\.(png|jpe?g|gif|webp|mp4|mov|svg)$/i) &&
        hasFile(snapshot, /(screenshot|demo|preview|hero|banner|docs\/)/i)
      if (asset) return { passed: true, detail: 'Preview asset detected in repo.' }
      return { passed: false }
    },
    fix: 'Add a screenshot, GIF, hosted demo, or terminal preview near the top of the README.',
  },
  {
    id: 'badges',
    category: 'first-impression',
    label: 'Status badges build instant trust',
    maxPoints: 4,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot)
      // Require an actual badge image, not just the word "badge" somewhere.
      const passed = /img\.shields\.io|badgen\.net|!\[[^\]]*\]\([^)]*\/badge\/[^)]*\)/i.test(text)
      return { passed }
    },
    fix: 'Add CI, license, version, or downloads badges under the title via shields.io.',
  },
  {
    id: 'buildable',
    category: 'runnability',
    label: 'A recognizable package manifest exists',
    maxPoints: 6,
    evaluate: (snapshot) => {
      if (snapshot.manifest) {
        return {
          passed: true,
          detail: `${snapshot.manifest.ecosystem} · ${snapshot.manifest.manifestFile}`,
        }
      }
      return { passed: false, detail: 'No package.json / pyproject / Cargo.toml / go.mod found.' }
    },
    fix: 'Add a standard manifest so people know how to install and what ecosystem this is.',
  },
  {
    id: 'license',
    category: 'trust',
    label: 'A license is declared',
    maxPoints: 10,
    evaluate: (snapshot) => {
      const file = snapshot.files.find((f) =>
        /^(licen[sc]e|copying|unlicense)(\.[a-z]+)?$/i.test(basenameOf(f)),
      )
      if (file) return { passed: true, detail: `${file} present` }
      const manifestLicense = snapshot.manifest?.license
      if (manifestLicense) return { passed: true, detail: `${manifestLicense} (manifest)` }
      const ghLicense = snapshot.github?.license
      if (ghLicense) return { passed: true, detail: `${ghLicense} (GitHub)` }
      return { passed: false }
    },
    fix: 'Add a LICENSE file (MIT, Apache-2.0, ...) so others know how they may use the code.',
  },
  {
    id: 'tests',
    category: 'trust',
    label: 'Automated tests exist',
    maxPoints: 9,
    evaluate: (snapshot) => {
      const testFile = hasFile(
        snapshot,
        /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.go$|(^|\/)test_[^/]+\.py$/i,
      )
      if (testFile) return { passed: true, detail: 'Test files detected.' }
      if (snapshot.manifest?.hasTestScript) return { passed: true, detail: 'Test script in manifest.' }
      return { passed: false }
    },
    fix: 'Add a test suite (even a small one) and a `test` command so contributors trust changes.',
  },
  {
    id: 'ci',
    category: 'trust',
    label: 'Continuous integration is configured',
    maxPoints: 8,
    evaluate: (snapshot) => {
      const ghAction = hasFile(snapshot, /^\.github\/workflows\/[^/]+\.ya?ml$/i)
      if (ghAction) return { passed: true, detail: 'GitHub Actions workflow found.' }
      const otherCi = hasFile(
        snapshot,
        /^(\.gitlab-ci\.yml|\.travis\.yml|\.drone\.yml|azure-pipelines\.yml|jenkinsfile)$|^\.circleci\//i,
      )
      if (otherCi) return { passed: true, detail: 'CI config found.' }
      return { passed: false }
    },
    fix: 'Add a CI workflow that runs build/lint/test on every push and pull request.',
  },
  {
    id: 'recency',
    category: 'trust',
    label: 'The project shows recent activity',
    maxPoints: 7,
    evaluate: (snapshot) => {
      const days = snapshot.git?.ageDays
      if (days === undefined) return { passed: false, detail: 'No commit date available.' }
      if (days <= RECENCY_WINDOW_DAYS) return { passed: true, detail: `Last commit ~${days}d ago` }
      return { passed: false, detail: `Last commit ~${days}d ago` }
    },
    fix: 'Make a small recent commit; a stale repo reads as abandoned to first-time visitors.',
  },
  {
    id: 'community-health',
    category: 'trust',
    label: 'Community health files are present',
    maxPoints: 5,
    evaluate: (snapshot) => {
      const has =
        hasBasename(snapshot, /^(code_of_conduct|security|support|funding)\.(md|ya?ml)$/i) ||
        hasFile(snapshot, /^\.github\/(issue_template|pull_request_template)/i)
      return { passed: has }
    },
    fix: 'Add a SECURITY.md, CODE_OF_CONDUCT.md, or issue/PR templates to signal a healthy project.',
  },
  {
    id: 'metadata',
    category: 'growth',
    label: 'Package metadata helps discovery',
    maxPoints: 7,
    evaluate: (snapshot) => {
      const description = snapshot.manifest?.description || snapshot.github?.description
      const keywordCount =
        (snapshot.manifest?.keywords?.length ?? 0) || (snapshot.github?.topics?.length ?? 0)
      if (description && keywordCount >= 3) {
        return { passed: true, detail: `${keywordCount} keywords/topics` }
      }
      if (!description) return { passed: false, detail: 'No description in manifest or repo settings.' }
      return { passed: false, detail: `Only ${keywordCount} keywords/topics (need 3+).` }
    },
    fix: 'Add a precise description and at least 3 searchable keywords / GitHub topics.',
  },
  {
    id: 'contributing',
    category: 'growth',
    label: 'A welcoming contribution path exists',
    maxPoints: 7,
    evaluate: (snapshot) => {
      const file = hasBasename(snapshot, /^contributing\.(md|rst|txt)$/i)
      const template = hasFile(snapshot, /^\.github\/(issue_template|pull_request_template)/i)
      const inReadme = /#{1,6}\s.*contribut|good first issue/i.test(readmeText(snapshot))
      return { passed: file || template || inReadme }
    },
    fix: 'Add a CONTRIBUTING.md or a README section with setup steps and good first issues.',
  },
  {
    id: 'releases',
    category: 'growth',
    label: 'Releases or a changelog show momentum',
    maxPoints: 6,
    evaluate: (snapshot) => {
      const changelog = hasBasename(snapshot, /^(changelog|changes|history)\.(md|rst|txt)$/i)
      if (changelog) return { passed: true, detail: 'CHANGELOG present.' }
      if (snapshot.github?.hasReleases) return { passed: true, detail: 'GitHub releases found.' }
      if ((snapshot.git?.tagCount ?? 0) > 0) {
        return { passed: true, detail: `${snapshot.git?.tagCount} git tags` }
      }
      return { passed: false }
    },
    fix: 'Cut a tagged release or add a CHANGELOG so people can see the project is evolving.',
  },
]

function gradeFor(score: number): Grade {
  if (score >= 82) return 'Launch-ready'
  if (score >= 58) return 'Promising'
  return 'Needs polish'
}

function summarize(score: number, items: AuditItem[]): string {
  const misses = items.filter((item) => !item.passed).length
  if (score >= 82) {
    return `Strong launch shape. ${misses} signal${misses === 1 ? '' : 's'} left before sharing widely.`
  }
  if (score >= 58) {
    return 'Good foundation. Close the highest-weight gaps before asking strangers for attention.'
  }
  return 'Needs clearer positioning and trust signals before launch. Start with the top fixes below.'
}

function buildCategories(items: AuditItem[]): CategoryScore[] {
  const order: AuditCategory[] = ['first-impression', 'runnability', 'trust', 'growth']
  return order.map((id) => {
    const inCategory = items.filter((item) => item.category === id)
    const points = inCategory.reduce((sum, item) => sum + item.points, 0)
    const maxPoints = inCategory.reduce((sum, item) => sum + item.maxPoints, 0)
    return {
      id,
      label: CATEGORY_LABELS[id],
      points,
      maxPoints,
      percent: maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100),
    }
  })
}

export function auditSnapshot(snapshot: RepoSnapshot): AuditReport {
  const items: AuditItem[] = rules.map((rule) => {
    const result = rule.evaluate(snapshot)
    return {
      id: rule.id,
      category: rule.category,
      label: rule.label,
      passed: result.passed,
      points: result.passed ? rule.maxPoints : 0,
      maxPoints: rule.maxPoints,
      fix: rule.fix,
      detail: result.detail,
    }
  })

  const totalPoints = items.reduce((sum, item) => sum + item.points, 0)
  const totalMax = items.reduce((sum, item) => sum + item.maxPoints, 0)
  const score = totalMax === 0 ? 0 : Math.round((totalPoints / totalMax) * 100)

  const checklist = items
    .filter((item) => !item.passed)
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .slice(0, 6)
    .map((item) => item.fix)

  return {
    projectName: snapshot.name,
    source: snapshot.source,
    score,
    grade: gradeFor(score),
    summary: summarize(score, items),
    items,
    categories: buildCategories(items),
    checklist,
  }
}

export function renderChecklist(report: AuditReport): string {
  const fixes =
    report.checklist.length > 0
      ? report.checklist.map((item) => `- [ ] ${item}`)
      : ['- [x] No launch blockers found. Keep the repo fresh and share it.']

  const passed = report.items
    .filter((item) => item.passed)
    .map((item) => `- [x] ${item.label} (+${item.points})`)

  return [
    `# ${report.projectName} launch checklist`,
    '',
    `Star-readiness score: ${report.score}/100 (${report.grade})`,
    report.summary,
    '',
    '## Fix next',
    ...fixes,
    '',
    '## Passed',
    ...passed,
    '',
    '_Generated by StarForge._',
    '',
  ].join('\n')
}
