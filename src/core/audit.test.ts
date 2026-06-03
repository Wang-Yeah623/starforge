import { describe, expect, it } from 'vitest'
import { auditSnapshot, renderChecklist } from './audit'
import type { RepoSnapshot } from './types'

const polishedReadme = `# Demo
A practical tool that helps maintainers prepare a GitHub launch with less guesswork.

![status](https://img.shields.io/badge/build-passing-green)
![screenshot](./docs/screenshot.png)

## Quickstart
\`\`\`bash
npm install
npm run demo
\`\`\`

## Contributing
Good first issues are welcome.
`

function polishedSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    name: 'demo',
    source: 'local',
    readme: { filename: 'README.md', text: polishedReadme },
    files: [
      'README.md',
      'LICENSE',
      'CONTRIBUTING.md',
      'CHANGELOG.md',
      'SECURITY.md',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/screenshot.png',
      'src/index.ts',
      'src/index.test.ts',
    ],
    manifest: {
      ecosystem: 'node',
      manifestFile: 'package.json',
      name: 'demo',
      description: 'A practical launch helper',
      license: 'MIT',
      keywords: ['github', 'readme', 'launch', 'open-source'],
      hasTestScript: true,
    },
    git: { lastCommitISO: '2026-06-01T00:00:00Z', ageDays: 2, tagCount: 3 },
    ...overrides,
  }
}

describe('auditSnapshot', () => {
  it('scores a polished project as launch-ready', () => {
    const report = auditSnapshot(polishedSnapshot())
    expect(report.score).toBeGreaterThanOrEqual(90)
    expect(report.grade).toBe('Launch-ready')
    expect(report.items.every((item) => item.passed)).toBe(true)
  })

  it('flags real missing files, not just missing keywords', () => {
    const report = auditSnapshot({
      name: 'thin',
      source: 'local',
      readme: { filename: 'README.md', text: '# Thin' },
      files: ['README.md'],
      manifest: null,
    })

    expect(report.score).toBeLessThan(40)
    expect(report.checklist.length).toBeGreaterThan(0)
    // The highest-weight miss is surfaced first; here that is positioning (12).
    expect(report.checklist[0]).toMatch(/sentence|under the H1/i)
    // These fail because the actual files are absent, not because a word is missing.
    const failed = (id: string) => report.items.find((item) => item.id === id)?.passed
    expect(failed('license')).toBe(false)
    expect(failed('ci')).toBe(false)
    expect(failed('tests')).toBe(false)
    expect(report.checklist.some((fix) => /license/i.test(fix))).toBe(true)
  })

  it('treats a stale repo as a missing recency signal', () => {
    const report = auditSnapshot(polishedSnapshot({ git: { ageDays: 900 } }))
    const recency = report.items.find((item) => item.id === 'recency')
    expect(recency?.passed).toBe(false)
  })

  it('aggregates four category scores covering every item', () => {
    const report = auditSnapshot(polishedSnapshot())
    expect(report.categories).toHaveLength(4)
    const categoryMax = report.categories.reduce((sum, c) => sum + c.maxPoints, 0)
    const itemMax = report.items.reduce((sum, item) => sum + item.maxPoints, 0)
    expect(categoryMax).toBe(itemMax)
  })

  it('renders a markdown checklist with the score', () => {
    const report = auditSnapshot(polishedSnapshot())
    const checklist = renderChecklist(report)
    expect(checklist).toContain('launch checklist')
    expect(checklist).toContain(`${report.score}/100`)
  })
})
