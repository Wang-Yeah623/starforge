import { describe, expect, it } from 'vitest'
import { auditSnapshot } from '../core/audit'
import { COMMENT_MARKER, renderComment } from './report-comment'
import type { RepoSnapshot } from '../core/types'

function snapshot(): RepoSnapshot {
  return {
    name: 'demo',
    source: 'local',
    readme: { filename: 'README.md', text: '# demo\nA neat little tool.' },
    files: ['README.md'],
    manifest: null,
  }
}

describe('renderComment', () => {
  it('includes the upsert marker, score, grade, and every category', () => {
    const report = auditSnapshot(snapshot())
    const comment = renderComment(report)
    expect(comment).toContain(COMMENT_MARKER)
    expect(comment).toContain(`${report.score}/100`)
    expect(comment).toContain(report.grade)
    for (const category of report.categories) {
      expect(comment).toContain(category.label)
    }
  })

  it('lists the next fixes for an incomplete repo', () => {
    const report = auditSnapshot(snapshot())
    expect(report.checklist.length).toBeGreaterThan(0)
    const comment = renderComment(report)
    expect(comment).toContain(report.checklist[0])
  })
})
