// Pure prompt construction + response parsing for the AI launch kit.
// No Node, no DOM, no network — testable in isolation and safe everywhere.
import type { AuditReport, RepoSnapshot } from '../core/types'

export type LaunchKit = {
  tagline: string
  description: string
  topics: string[]
  readmeFixes: Array<{ title: string; suggestion: string }>
  launchPost: string
}

export type LaunchKitPrompt = { system: string; user: string }

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text
}

export function buildLaunchKitPrompt(report: AuditReport, snapshot?: RepoSnapshot): LaunchKitPrompt {
  const failing = report.items
    .filter((item) => !item.passed)
    .map((item) => `- ${item.label}: ${item.fix}`)
    .join('\n')

  const system = [
    'You are StarForge, an assistant that helps open-source maintainers launch projects.',
    'Return ONLY a single minified JSON object, no prose and no code fences.',
    'It must match this TypeScript type exactly:',
    '{"tagline":string,"description":string,"topics":string[],"readmeFixes":{"title":string,"suggestion":string}[],"launchPost":string}',
    'tagline: under 140 characters, concrete, no hype. description: 1-2 sentences.',
    'topics: 5-8 lowercase GitHub topics. readmeFixes: 3-5 specific edits that address the weak signals.',
    'launchPost: a short "Show HN"-style post (plain markdown) a stranger would click.',
  ].join(' ')

  const user = [
    `Project: ${report.projectName}`,
    `StarForge score: ${report.score}/100 (${report.grade})`,
    snapshot?.manifest?.description ? `Current description: ${snapshot.manifest.description}` : '',
    snapshot?.github?.description ? `Repo description: ${snapshot.github.description}` : '',
    '',
    'Weak signals to address:',
    failing || '(none — focus on sharper positioning and a stronger launch post)',
    '',
    snapshot?.readme?.text ? 'README (may be truncated):' : '',
    snapshot?.readme?.text ? truncate(snapshot.readme.text, 4000) : '',
  ]
    .filter((line) => line !== '')
    .join('\n')

  return { system, user }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

// Extracts the JSON object from a model response that may wrap it in prose or
// code fences, then validates it into a LaunchKit with safe fallbacks.
export function parseLaunchKit(text: string): LaunchKit {
  const withoutFences = text.replace(/```(?:json)?/gi, '')
  const start = withoutFences.indexOf('{')
  const end = withoutFences.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model did not return JSON.')
  }

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(withoutFences.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    throw new Error('The model returned malformed JSON.')
  }

  const fixes = Array.isArray(raw.readmeFixes) ? raw.readmeFixes : []
  return {
    tagline: asString(raw.tagline),
    description: asString(raw.description),
    topics: asStringArray(raw.topics),
    readmeFixes: fixes
      .map((fix) => {
        const record = (fix ?? {}) as Record<string, unknown>
        return { title: asString(record.title), suggestion: asString(record.suggestion) }
      })
      .filter((fix) => fix.title || fix.suggestion),
    launchPost: asString(raw.launchPost),
  }
}
