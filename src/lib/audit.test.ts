import { describe, expect, it } from 'vitest'
import { auditProject, renderChecklist } from './audit'

describe('auditProject', () => {
  it('scores a polished open-source project highly', () => {
    const report = auditProject({
      projectName: 'demo',
      packageJson: {
        description: 'A useful launch helper',
        keywords: ['github', 'readme', 'launch', 'open-source'],
        license: 'MIT',
        scripts: { test: 'vitest run' },
      },
      readme: `# Demo
A practical tool that helps maintainers prepare a GitHub launch with less guesswork.

![screenshot](./screenshot.png)

## Quickstart
\`\`\`bash
npm install
npm run demo
\`\`\`

## Features
- Audit README quality
- Generate launch checklists

## Contributing
Good first issues are welcome.

## Launch
Share this with maintainers.

## Roadmap
- Add more templates

## License
MIT
`,
    })

    expect(report.score).toBeGreaterThanOrEqual(90)
    expect(report.grade).toBe('Launch-ready')
  })

  it('returns actionable checklist items for thin projects', () => {
    const report = auditProject({ projectName: 'thin', readme: '# Thin' })
    const checklist = renderChecklist(report)

    expect(report.score).toBeLessThan(40)
    expect(report.checklist.length).toBeGreaterThan(0)
    expect(checklist).toContain('launch checklist')
  })
})
