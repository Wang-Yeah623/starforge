// Shared, framework-agnostic types for the StarForge audit engine.
// Everything here is pure data: no Node, no DOM, safe to import anywhere.

export type Ecosystem = 'node' | 'python' | 'rust' | 'go' | 'unknown'

export type RepoManifest = {
  ecosystem: Ecosystem
  manifestFile: string
  name?: string
  description?: string
  license?: string
  keywords?: string[]
  homepage?: string
  hasTestScript?: boolean
}

export type RepoGit = {
  lastCommitISO?: string
  ageDays?: number
  tagCount?: number
}

export type RepoGitHub = {
  description?: string
  topics?: string[]
  homepage?: string
  stars?: number
  license?: string
  hasReleases?: boolean
  openIssues?: number
}

export type RepoReadme = {
  filename: string
  text: string
}

// A normalized view of a repository. Adapters (local fs, GitHub API, ...)
// produce this; the audit engine only ever reads it.
export type RepoSnapshot = {
  name: string
  source: 'local' | 'github'
  readme: RepoReadme | null
  // Repository-relative file paths that exist, using '/' separators.
  files: string[]
  manifest: RepoManifest | null
  git?: RepoGit
  github?: RepoGitHub
}

export type AuditCategory = 'first-impression' | 'runnability' | 'trust' | 'growth'

export type AuditItem = {
  id: string
  category: AuditCategory
  label: string
  passed: boolean
  points: number
  maxPoints: number
  fix: string
  detail?: string
}

export type Grade = 'Launch-ready' | 'Promising' | 'Needs polish'

export type CategoryScore = {
  id: AuditCategory
  label: string
  points: number
  maxPoints: number
  percent: number
}

export type AuditReport = {
  projectName: string
  source: 'local' | 'github'
  score: number
  grade: Grade
  summary: string
  items: AuditItem[]
  categories: CategoryScore[]
  checklist: string[]
}
