import { auditSnapshot } from '../src/core/audit'
import { parseRepoSlug, snapshotFromGithub, type GithubError } from '../src/adapters/github'

export const config = { runtime: 'edge' }

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': status === 200 ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
    },
  })
}

export default async function handler(request: Request): Promise<Response> {
  const slug = parseRepoSlug(new URL(request.url).searchParams.get('repo') ?? '')
  if (!slug) return json({ error: 'Pass ?repo=owner/name' }, 400)

  try {
    const snapshot = await snapshotFromGithub(slug.owner, slug.repo, { token: process.env.GITHUB_TOKEN })
    return json(auditSnapshot(snapshot), 200)
  } catch (error) {
    const status = (error as GithubError).status
    if (status === 404) return json({ error: 'Repository not found (or private).' }, 404)
    if (status === 403) return json({ error: 'GitHub API rate limit hit. Try again later.' }, 429)
    return json({ error: 'Audit failed.' }, 500)
  }
}
