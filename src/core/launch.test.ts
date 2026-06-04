import { describe, expect, it } from 'vitest'
import { auditSnapshot } from './audit'
import { renderLaunchPost } from './launch'
import type { RepoSnapshot } from './types'

const launchReady: RepoSnapshot = {
  name: 'demo',
  source: 'local',
  readme: {
    filename: 'README.md',
    text: '# demo\nA practical tool that helps maintainers prepare a GitHub launch.\n\n![badge](https://img.shields.io/badge/x-y-green)\n![shot](./a.png)\n\n## Quickstart\n```bash\nnpm i\n```\n\n## Contributing\nGood first issues.',
  },
  files: ['README.md', 'LICENSE', 'CONTRIBUTING.md', 'CHANGELOG.md', '.github/workflows/ci.yml', 'a.png', 'x.test.ts'],
  manifest: { ecosystem: 'node', manifestFile: 'package.json', description: 'A launch helper', keywords: ['a', 'b', 'c'], hasTestScript: true },
  git: { ageDays: 1, tagCount: 2 },
}

const thin: RepoSnapshot = {
  name: 'thin',
  source: 'local',
  readme: { filename: 'README.md', text: '# thin' },
  files: ['README.md'],
  manifest: null,
}

describe('renderLaunchPost', () => {
  it('writes a confident post for a launch-ready repo', () => {
    const report = auditSnapshot(launchReady)
    const post = renderLaunchPost(report, { description: 'A launch helper', url: 'https://example.com' })
    expect(post).toContain('I built demo: A launch helper')
    expect(post).toContain(`${report.score}/100`)
    expect(post).toContain('launch-ready')
    expect(post).toContain('Try it: https://example.com')
  })

  it('surfaces the top fix as the next step for an unfinished repo', () => {
    const report = auditSnapshot(thin)
    const post = renderLaunchPost(report)
    expect(post).toContain('Next up:')
    expect(post).not.toContain('Try it: ') // no url provided
    expect(post).toContain('thin')
  })
})
