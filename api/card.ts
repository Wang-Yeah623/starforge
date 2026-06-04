import { auditSnapshot } from '../src/core/audit'
import { parseRepoSlug, snapshotFromGithub, type GithubError } from '../src/adapters/github'
import { renderCard, type CardTheme } from '../src/card/card'

export const config = { runtime: 'edge' }

const SVG_HEADERS = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  // Refresh roughly every 6h while staying fast and rate-limit friendly.
  'Cache-Control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400',
}

function errorCard(message: string): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="64" role="img"><rect x="0.5" y="0.5" width="459" height="63" rx="12" fill="#FBECEC" stroke="#E0B4B4"/><text x="24" y="38" font-family="-apple-system,Segoe UI,sans-serif" font-size="15" fill="#9B2C2C">StarForge: ${message}</text></svg>`
  return new Response(svg, { status: 200, headers: { ...SVG_HEADERS, 'Cache-Control': 'no-store' } })
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const slug = parseRepoSlug(url.searchParams.get('repo') ?? '')
  if (!slug) return errorCard('add ?repo=owner/name')

  const theme: CardTheme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'

  try {
    const snapshot = await snapshotFromGithub(slug.owner, slug.repo, { token: process.env.GITHUB_TOKEN })
    const report = auditSnapshot(snapshot)
    return new Response(renderCard(report, { theme }), { headers: SVG_HEADERS })
  } catch (error) {
    const status = (error as GithubError).status
    return errorCard(status === 404 ? 'repo not found' : status === 403 ? 'rate limited' : 'audit failed')
  }
}
