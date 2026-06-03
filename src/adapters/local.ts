import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import { detectManifest, parseManifest } from '../core/manifest'
import type { RepoSnapshot } from '../core/types'

// Directories that never carry launch signals but would slow down or pollute
// the scan if walked.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-cli',
  'dist-ssr',
  'build',
  'out',
  'target',
  'vendor',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.venv',
  'venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  'coverage',
  '.turbo',
  '.cache',
])

const MAX_DEPTH = 3

function listFiles(root: string): string[] {
  const out: string[] = []

  const walk = (dir: string, depth: number) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (depth >= MAX_DEPTH) continue
        walk(full, depth + 1)
      } else if (entry.isFile()) {
        out.push(relative(root, full).split(sep).join('/'))
      }
    }
  }

  walk(root, 0)
  return out
}

function readFileSafe(root: string, relPath: string): string | undefined {
  try {
    return readFileSync(join(root, relPath), 'utf8')
  } catch {
    return undefined
  }
}

function findReadme(files: string[]): string | undefined {
  return files.find(
    (file) => !file.includes('/') && /^readme(\.(md|markdown|rst|txt))?$/i.test(file),
  )
}

function readManifest(root: string, files: string[]): RepoSnapshot['manifest'] {
  const detected = detectManifest(files)
  if (!detected) return null
  const text = readFileSafe(root, detected.manifestFile) ?? ''
  return parseManifest(detected, text)
}

function git(root: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

function readGit(root: string): RepoSnapshot['git'] {
  const lastCommitISO = git(root, ['log', '-1', '--format=%cI'])
  const ageDays = lastCommitISO
    ? Math.max(0, Math.floor((Date.now() - Date.parse(lastCommitISO)) / 86_400_000))
    : undefined
  const tags = git(root, ['tag'])
  const tagCount = tags ? tags.split('\n').filter(Boolean).length : undefined
  if (lastCommitISO === undefined && tagCount === undefined) return undefined
  return { lastCommitISO, ageDays, tagCount }
}

export function snapshotFromLocal(root: string): RepoSnapshot {
  const files = listFiles(root)
  const readmePath = findReadme(files)
  const readme = readmePath
    ? { filename: readmePath, text: readFileSafe(root, readmePath) ?? '' }
    : null
  const manifest = readManifest(root, files)
  const name = manifest?.name || basename(root) || 'project'

  return {
    name,
    source: 'local',
    readme,
    files,
    manifest,
    git: readGit(root),
  }
}
