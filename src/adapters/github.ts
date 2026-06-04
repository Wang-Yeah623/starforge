// Builds a RepoSnapshot from the GitHub REST API. Edge-safe: uses only fetch,
// atob, and TextDecoder, so it runs in Vercel Edge functions and in Node.
import { detectManifest, parseManifest } from '../core/manifest'
import type { RepoSnapshot } from '../core/types'

const API = 'https://api.github.com'

export type GithubOptions = { token?: string }

export type GithubError = Error & { status?: number }

type RepoMeta = {
  name?: string
  description?: string | null
  topics?: string[]
  homepage?: string | null
  stargazers_count?: number
  default_branch?: string
  pushed_at?: string
  open_issues_count?: number
  license?: { spdx_id?: string | null; name?: string | null } | null
}

type TreeResponse = { tree?: Array<{ path: string; type: string }> }
type ContentResponse = { content?: string; encoding?: string; name?: string }

function headers(token?: string): Record<string, string> {
  const result: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'starforge',
  }
  if (token) result.Authorization = `Bearer ${token}`
  return result
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function ghJson<T>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, { headers: headers(token) })
  if (!response.ok) {
    const error = new Error(`GitHub API responded ${response.status}`) as GithubError
    error.status = response.status
    throw error
  }
  return (await response.json()) as T
}

async function ghJsonOrNull<T>(url: string, token?: string): Promise<T | null> {
  try {
    return await ghJson<T>(url, token)
  } catch {
    return null
  }
}

export function parseRepoSlug(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '')
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(cleaned)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

export async function snapshotFromGithub(
  owner: string,
  repo: string,
  options: GithubOptions = {},
): Promise<RepoSnapshot> {
  const { token } = options
  const meta = await ghJson<RepoMeta>(`${API}/repos/${owner}/${repo}`, token)
  const branch = meta.default_branch || 'main'

  const tree = await ghJsonOrNull<TreeResponse>(
    `${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token,
  )
  const files = (tree?.tree ?? []).filter((node) => node.type === 'blob').map((node) => node.path)

  let readme: RepoSnapshot['readme'] = null
  const readmeData = await ghJsonOrNull<ContentResponse>(`${API}/repos/${owner}/${repo}/readme`, token)
  if (readmeData?.content) {
    readme = {
      filename: readmeData.name || 'README.md',
      text: readmeData.encoding === 'base64' ? decodeBase64(readmeData.content) : readmeData.content,
    }
  }

  let manifest: RepoSnapshot['manifest'] = null
  const detected = detectManifest(files)
  if (detected) {
    const content = await ghJsonOrNull<ContentResponse>(
      `${API}/repos/${owner}/${repo}/contents/${detected.manifestFile}?ref=${branch}`,
      token,
    )
    const text =
      content?.content && content.encoding === 'base64'
        ? decodeBase64(content.content)
        : content?.content ?? ''
    manifest = parseManifest(detected, text)
  }

  const releases = await ghJsonOrNull<unknown[]>(
    `${API}/repos/${owner}/${repo}/releases?per_page=1`,
    token,
  )

  const ageDays = meta.pushed_at
    ? Math.max(0, Math.floor((Date.now() - Date.parse(meta.pushed_at)) / 86_400_000))
    : undefined

  return {
    name: meta.name || repo,
    source: 'github',
    readme,
    files,
    manifest,
    git: { lastCommitISO: meta.pushed_at, ageDays },
    github: {
      description: meta.description ?? undefined,
      topics: meta.topics ?? undefined,
      homepage: meta.homepage ?? undefined,
      stars: meta.stargazers_count,
      license: meta.license?.spdx_id ?? meta.license?.name ?? undefined,
      hasReleases: Array.isArray(releases) && releases.length > 0,
      openIssues: meta.open_issues_count,
    },
  }
}
