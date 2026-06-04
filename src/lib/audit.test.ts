import { describe, expect, it } from 'vitest'
import {
  auditProject,
  generateBadges,
  generateLaunchPost,
  renderChecklist,
} from './audit'

describe('auditProject', () => {
  it('scores a polished open-source project highly', () => {
    const report = auditProject({
      projectName: 'demo',
      hasLicenseFile: true,
      hasContributingFile: true,
      hasCi: true,
      hasChangelog: true,
      hasIssueTemplates: true,
      packageJson: {
        description: 'A useful launch helper',
        keywords: ['github', 'readme', 'launch', 'open-source'],
        license: 'MIT',
        scripts: { test: 'vitest run' },
      },
      readme: `# Demo
A practical tool that helps maintainers prepare a GitHub launch with less guesswork.

![CI](https://img.shields.io/badge/CI-passing-green)
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

  it('credits repo file signals even when the README is silent', () => {
    const withFiles = auditProject({
      projectName: 'files',
      readme: '# Files\nA minimal readme with no extra sections at all here.',
      hasLicenseFile: true,
      hasContributingFile: true,
      hasCi: true,
      hasChangelog: true,
      hasIssueTemplates: true,
    })
    const withoutFiles = auditProject({
      projectName: 'files',
      readme: '# Files\nA minimal readme with no extra sections at all here.',
    })

    expect(withFiles.score).toBeGreaterThan(withoutFiles.score)
    const licenseItem = withFiles.items.find((item) => item.id === 'license')
    expect(licenseItem?.passed).toBe(true)
  })
})

describe('generateBadges', () => {
  it('builds shields.io badges from package metadata', () => {
    const badges = generateBadges({
      projectName: 'starforge',
      packageJson: { license: 'MIT', version: '0.1.0' },
    })

    expect(badges.some((badge) => badge.includes('license-MIT'))).toBe(true)
    expect(badges.some((badge) => badge.includes('version-0.1.0'))).toBe(true)
    expect(badges.some((badge) => badge.includes('github/stars'))).toBe(true)
  })
})

describe('generateLaunchPost', () => {
  it('embeds the score and project name in the post', () => {
    const input = {
      projectName: 'starforge',
      readme: '# StarForge\nAudit GitHub projects for launch readiness quickly.',
      packageJson: { description: 'Audit, polish, and launch GitHub projects.' },
    }
    const report = auditProject(input)
    const post = generateLaunchPost(report, input)

    expect(post).toContain('starforge')
    expect(post).toContain(`${report.score}/100`)
  })
})
