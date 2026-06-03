import { describe, expect, it } from 'vitest'
import { buildLaunchKitPrompt, parseLaunchKit } from './launch-kit'
import { auditSnapshot } from '../core/audit'
import type { RepoSnapshot } from '../core/types'

const snapshot: RepoSnapshot = {
  name: 'demo',
  source: 'local',
  readme: { filename: 'README.md', text: '# demo' },
  files: ['README.md'],
  manifest: null,
}

describe('buildLaunchKitPrompt', () => {
  it('asks for strict JSON and includes the project and weak signals', () => {
    const prompt = buildLaunchKitPrompt(auditSnapshot(snapshot), snapshot)
    expect(prompt.system).toMatch(/only.*json/i)
    expect(prompt.user).toContain('demo')
    expect(prompt.user).toMatch(/Weak signals/i)
  })
})

describe('parseLaunchKit', () => {
  const valid = JSON.stringify({
    tagline: 'A tiny tool',
    description: 'Does one thing well.',
    topics: ['cli', 'tool'],
    readmeFixes: [{ title: 'Add a demo', suggestion: 'Show a GIF.' }],
    launchPost: 'Show HN: demo',
  })

  it('parses a clean JSON response', () => {
    const kit = parseLaunchKit(valid)
    expect(kit.tagline).toBe('A tiny tool')
    expect(kit.topics).toEqual(['cli', 'tool'])
    expect(kit.readmeFixes[0].title).toBe('Add a demo')
  })

  it('recovers JSON wrapped in prose and code fences', () => {
    const wrapped = 'Sure! Here you go:\n```json\n' + valid + '\n```\nHope that helps.'
    expect(parseLaunchKit(wrapped).description).toBe('Does one thing well.')
  })

  it('coerces missing or malformed fields to safe defaults', () => {
    const kit = parseLaunchKit('{"tagline":"x","topics":"not-an-array","readmeFixes":[{}]}')
    expect(kit.tagline).toBe('x')
    expect(kit.topics).toEqual([])
    expect(kit.readmeFixes).toEqual([])
    expect(kit.launchPost).toBe('')
  })

  it('throws when there is no JSON object', () => {
    expect(() => parseLaunchKit('no json here')).toThrow()
  })
})
