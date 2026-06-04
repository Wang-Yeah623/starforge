import { describe, expect, it } from 'vitest'
import { auditSnapshot } from '../core/audit'
import { badgeUrl, embedSnippet, renderCard } from './card'
import type { RepoSnapshot } from '../core/types'

function snapshot(name = 'demo'): RepoSnapshot {
  return {
    name,
    source: 'local',
    readme: { filename: 'README.md', text: '# demo\nA tidy tool that does one useful thing well for developers.' },
    files: ['README.md', 'LICENSE', 'package.json'],
    manifest: { ecosystem: 'node', manifestFile: 'package.json', description: 'x', keywords: ['a', 'b', 'c'] },
    git: { ageDays: 1 },
  }
}

describe('renderCard', () => {
  it('produces a single self-contained SVG with the score and name', () => {
    const report = auditSnapshot(snapshot())
    const svg = renderCard(report)
    expect(svg.trimStart().startsWith('<svg')).toBe(true)
    expect(svg.match(/<svg/g)).toHaveLength(1)
    expect(svg).toContain(`>${report.score}<`)
    expect(svg).toContain('demo')
    expect(svg).toContain(report.grade)
    // No external resources that would break GitHub's image proxy.
    expect(svg).not.toMatch(/<image|xlink:href|<script/)
  })

  it('themes the background differently for dark mode', () => {
    const report = auditSnapshot(snapshot())
    expect(renderCard(report, { theme: 'dark' })).toContain('#0D1117')
    expect(renderCard(report, { theme: 'light' })).toContain('#FFFFFF')
  })

  it('escapes XML-unsafe characters in the project name', () => {
    const report = auditSnapshot(snapshot('a<b&c'))
    const svg = renderCard(report)
    expect(svg).toContain('a&lt;b&amp;c')
    expect(svg).not.toContain('a<b&c')
  })

  it('builds a shields badge URL and an embed snippet', () => {
    const report = auditSnapshot(snapshot())
    expect(badgeUrl(report)).toContain(`${report.score}%2F100`)
    expect(badgeUrl(report)).toMatch(/^https:\/\/img\.shields\.io\/badge\//)
    expect(embedSnippet(report)).toContain('starforge-card.svg')
  })
})
