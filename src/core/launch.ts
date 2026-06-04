// Deterministic, no-API-key launch copy derived straight from the audit report.
// This complements the optional AI launch kit (src/ai): it needs no key and
// always works. Pure — depends only on the report.
import type { AuditReport } from './types'

export type LaunchPostOptions = {
  // A one-line description (e.g. from the manifest). Falls back to the summary.
  description?: string
  // A URL to point readers at (repo, demo, npm).
  url?: string
}

export function renderLaunchPost(report: AuditReport, options: LaunchPostOptions = {}): string {
  const description = options.description?.trim() || report.summary
  const topFix = report.checklist[0]

  const closer =
    report.grade === 'Launch-ready'
      ? 'It is launch-ready — feedback welcome.'
      : topFix
        ? `Next up: ${topFix.replace(/\.$/, '')}.`
        : 'Early, but moving fast.'

  const lines = [
    `I built ${report.projectName}: ${description}`,
    '',
    `StarForge launch-readiness: ${report.score}/100 (${report.grade}). ${closer}`,
    '',
    options.url ? `Try it: ${options.url}` : 'Try it and let me know what you think.',
  ]

  return lines.join('\n')
}
