// StarForge GitHub Action — zero-dependency.
// Reads inputs from INPUT_* env vars, audits the workspace, optionally writes a
// score card, upserts a pull-request comment via the REST API, and can fail the
// job when the score is below a threshold.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { auditSnapshot } from '../core/audit'
import { snapshotFromLocal } from '../adapters/local'
import { renderCard } from '../card/card'
import { COMMENT_MARKER, renderComment } from './report-comment'

function getInput(name: string, fallback = ''): string {
  const key = `INPUT_${name.toUpperCase().replace(/ /g, '_')}`
  const value = process.env[key]
  return (value === undefined || value === '' ? fallback : value).trim()
}

function isFalse(value: string): boolean {
  return value.toLowerCase() === 'false'
}

function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT
  if (file) appendFileSync(file, `${name}=${value}\n`)
}

const API = 'https://api.github.com'

async function upsertComment(
  token: string,
  repoFull: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const [owner, repo] = repoFull.split('/')
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'starforge-action',
    'Content-Type': 'application/json',
  }

  const listResponse = await fetch(
    `${API}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    { headers },
  )
  const comments = listResponse.ok ? ((await listResponse.json()) as Array<{ id: number; body?: string }>) : []
  const existing = Array.isArray(comments)
    ? comments.find((comment) => typeof comment.body === 'string' && comment.body.includes(COMMENT_MARKER))
    : undefined

  if (existing) {
    await fetch(`${API}/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body }),
    })
  } else {
    await fetch(`${API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    })
  }
}

async function run(): Promise<void> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()
  const root = resolve(workspace, getInput('path', '.') || '.')

  const report = auditSnapshot(snapshotFromLocal(root))
  console.log(`StarForge score: ${report.score}/100 (${report.grade})`)
  setOutput('score', String(report.score))
  setOutput('grade', report.grade)

  if (!isFalse(getInput('card', 'true'))) {
    writeFileSync(join(root, 'starforge-card.svg'), renderCard(report, { theme: 'light' }))
    writeFileSync(join(root, 'starforge-card-dark.svg'), renderCard(report, { theme: 'dark' }))
  }

  const token = getInput('token') || process.env.GITHUB_TOKEN || ''
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!isFalse(getInput('comment', 'true')) && token && eventPath) {
    try {
      const event = JSON.parse(readFileSync(eventPath, 'utf8')) as {
        pull_request?: { number?: number }
        issue?: { number?: number }
      }
      const issueNumber = event.pull_request?.number ?? event.issue?.number
      const repoFull = process.env.GITHUB_REPOSITORY
      if (issueNumber && repoFull) {
        await upsertComment(token, repoFull, issueNumber, renderComment(report))
        console.log(`Posted StarForge audit to #${issueNumber}.`)
      } else {
        console.log('No pull request in this event; skipping comment.')
      }
    } catch (error) {
      console.log(`::warning::Could not post PR comment: ${(error as Error).message}`)
    }
  }

  const failUnder = Number.parseInt(getInput('fail-under', '0'), 10) || 0
  if (failUnder > 0 && report.score < failUnder) {
    console.log(`::error::StarForge score ${report.score} is below the required minimum of ${failUnder}.`)
    process.exitCode = 1
  }
}

run().catch((error: unknown) => {
  console.log(`::error::${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
