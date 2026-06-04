import type { ProjectInput } from './audit'

export type RepoSlug = {
  owner: string
  repo: string
}

/**
 * Parse `owner/repo` from a GitHub URL or a plain `owner/repo` slug.
 * Returns null when the input cannot be understood.
 */
export function parseRepoSlug(input: string): RepoSlug | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  let candidate = trimmed

  // Strip a full URL down to its pathname.
  const urlMatch = trimmed.match(/github\.com[/:]([^?#]+)/i)
  if (urlMatch) {
    candidate = urlMatch[1]
  }

  const parts = candidate
    .split('/')
    .filter(Boolean)

  if (parts.length < 2) {
    return null
  }

  const [owner, repoRaw] = parts
  const repo = repoRaw.replace(/\.git$/i, '')
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return null
  }

  return { owner, repo }
}

type Fetcher = typeof fetch

const GITHUB_API = 'https://api.github.com'
const GITHUB_RAW = 'https://raw.githubusercontent.com'

async function fetchText(fetcher: Fetcher, url: string): Promise<string | null> {
  const response = await fetcher(url)
  if (!response.ok) {
    return null
  }
  return response.text()
}

async function pathExists(
  fetcher: Fetcher,
  slug: RepoSlug,
  path: string,
): Promise<boolean> {
  const response = await fetcher(
    `${GITHUB_API}/repos/${slug.owner}/${slug.repo}/contents/${path}`,
  )
  return response.ok
}

/**
 * Fetch a public GitHub repository and assemble a ProjectInput for auditing.
 * Uses the anonymous GitHub API, so it is rate limited but needs no token.
 */
export async function fetchRepoInput(
  input: string,
  fetcher: Fetcher = fetch,
): Promise<ProjectInput> {
  const slug = parseRepoSlug(input)
  if (!slug) {
    throw new Error(`Could not parse a GitHub repo from "${input}". Use owner/repo or a GitHub URL.`)
  }

  const repoResponse = await fetcher(`${GITHUB_API}/repos/${slug.owner}/${slug.repo}`)
  if (repoResponse.status === 404) {
    throw new Error(`Repository ${slug.owner}/${slug.repo} was not found or is private.`)
  }
  if (repoResponse.status === 403) {
    throw new Error('GitHub API rate limit reached. Try again later.')
  }
  if (!repoResponse.ok) {
    throw new Error(`GitHub request failed with status ${repoResponse.status}.`)
  }

  const meta = (await repoResponse.json()) as {
    default_branch?: string
    license?: { spdx_id?: string } | null
    description?: string | null
  }
  const branch = meta.default_branch || 'main'
  const rawBase = `${GITHUB_RAW}/${slug.owner}/${slug.repo}/${branch}`

  const [readme, packageRaw, hasLicenseFile, hasContributingFile, hasChangelog, hasCi, hasIssueTemplates] =
    await Promise.all([
      fetchText(fetcher, `${rawBase}/README.md`),
      fetchText(fetcher, `${rawBase}/package.json`),
      meta.license?.spdx_id ? Promise.resolve(true) : pathExists(fetcher, slug, 'LICENSE'),
      pathExists(fetcher, slug, 'CONTRIBUTING.md'),
      pathExists(fetcher, slug, 'CHANGELOG.md'),
      pathExists(fetcher, slug, '.github/workflows'),
      pathExists(fetcher, slug, '.github/ISSUE_TEMPLATE'),
    ])

  let packageJson: Record<string, unknown> = {}
  if (packageRaw) {
    try {
      packageJson = JSON.parse(packageRaw) as Record<string, unknown>
    } catch {
      packageJson = {}
    }
  }

  return {
    projectName: slug.repo,
    readme: readme ?? '',
    packageJson,
    hasLicenseFile,
    hasContributingFile,
    hasChangelog,
    hasCi,
    hasIssueTemplates,
  }
}
