import { auditSnapshot } from '../src/core/audit'
import { parseRepoSlug, snapshotFromGithub } from '../src/adapters/github'

export const config = { runtime: 'edge' }

// Shields.io "endpoint" badge. Embed via:
// https://img.shields.io/endpoint?url=<encoded>/api/badge?repo=owner/name
function json(body: unknown, cache: string): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cache,
    },
  })
}

export default async function handler(request: Request): Promise<Response> {
  const slug = parseRepoSlug(new URL(request.url).searchParams.get('repo') ?? '')
  const base = { schemaVersion: 1, label: 'StarForge' }
  if (!slug) return json({ ...base, message: 'owner/name?', color: 'lightgrey' }, 'no-store')

  try {
    const report = auditSnapshot(
      await snapshotFromGithub(slug.owner, slug.repo, { token: process.env.GITHUB_TOKEN }),
    )
    const color = report.score >= 82 ? 'brightgreen' : report.score >= 58 ? 'yellow' : 'red'
    return json(
      { ...base, message: `${report.score}/100`, color },
      'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400',
    )
  } catch {
    return json({ ...base, message: 'error', color: 'lightgrey' }, 'no-store')
  }
}
