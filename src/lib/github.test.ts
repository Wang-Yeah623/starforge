import { describe, expect, it } from 'vitest'
import { fetchRepoInput, parseRepoSlug } from './github'

describe('parseRepoSlug', () => {
  it('parses a plain owner/repo slug', () => {
    expect(parseRepoSlug('vercel/next.js')).toEqual({ owner: 'vercel', repo: 'next.js' })
  })

  it('parses an https GitHub URL', () => {
    expect(parseRepoSlug('https://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    })
  })

  it('strips a trailing .git and extra path segments', () => {
    expect(parseRepoSlug('https://github.com/owner/repo.git/tree/main')).toEqual({
      owner: 'owner',
      repo: 'repo',
    })
  })

  it('returns null for unparseable input', () => {
    expect(parseRepoSlug('not a repo')).toBeNull()
    expect(parseRepoSlug('')).toBeNull()
    expect(parseRepoSlug('owner')).toBeNull()
  })
})

describe('fetchRepoInput', () => {
  it('assembles a ProjectInput from mocked GitHub responses', async () => {
    const fakeFetch = (async (url: string | URL) => {
      const target = url.toString()
      if (target.endsWith('/repos/acme/widget')) {
        return new Response(
          JSON.stringify({ default_branch: 'main', license: { spdx_id: 'MIT' } }),
          { status: 200 },
        )
      }
      if (target.endsWith('/README.md')) {
        return new Response('# Widget\nA great tool.', { status: 200 })
      }
      if (target.endsWith('/package.json')) {
        return new Response(JSON.stringify({ name: 'widget', version: '1.0.0' }), {
          status: 200,
        })
      }
      if (target.includes('/contents/.github/workflows')) {
        return new Response('[]', { status: 200 })
      }
      return new Response('', { status: 404 })
    }) as typeof fetch

    const input = await fetchRepoInput('acme/widget', fakeFetch)

    expect(input.projectName).toBe('widget')
    expect(input.readme).toContain('# Widget')
    expect(input.packageJson?.version).toBe('1.0.0')
    expect(input.hasLicenseFile).toBe(true)
    expect(input.hasCi).toBe(true)
    expect(input.hasContributingFile).toBe(false)
  })

  it('throws a clear error for a missing repo', async () => {
    const notFound = (async () => new Response('', { status: 404 })) as typeof fetch
    await expect(fetchRepoInput('acme/missing', notFound)).rejects.toThrow(/not found/i)
  })
})
