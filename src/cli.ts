import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { auditSnapshot, renderChecklist } from './core/audit'
import { snapshotFromLocal } from './adapters/local'
import { parseRepoSlug, snapshotFromGithub, type GithubError } from './adapters/github'
import { embedSnippet, renderCard } from './card/card'
import { generateLaunchKit, type AiConfig, type AiProvider } from './ai/client'
import type { AuditReport, RepoSnapshot } from './core/types'

type CliOptions = {
  cwd: string
  repo?: string
  json: boolean
  checklist: boolean
  card: boolean
  launchKit: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    json: false,
    checklist: false,
    card: false,
    launchKit: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--path' || arg === '-p') {
      options.cwd = resolve(argv[index + 1] || options.cwd)
      index += 1
      continue
    }

    if (arg === '--repo' || arg === '-r') {
      options.repo = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--checklist') {
      options.checklist = true
      continue
    }

    if (arg === '--card') {
      options.card = true
      continue
    }

    if (arg === '--launch-kit') {
      options.launchKit = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    // A bare `owner/repo` (or GitHub URL) audits a remote repository.
    if (!arg.startsWith('-') && parseRepoSlug(arg)) {
      options.repo = arg
    }
  }

  return options
}

function bar(percent: number): string {
  const filled = Math.round((percent / 100) * 10)
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`
}

async function loadSnapshot(options: CliOptions): Promise<RepoSnapshot> {
  if (options.repo) {
    const slug = parseRepoSlug(options.repo)
    if (!slug) throw new Error(`Invalid repo "${options.repo}". Use the owner/name form.`)
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined
    return snapshotFromGithub(slug.owner, slug.repo, { token })
  }
  return snapshotFromLocal(options.cwd)
}

function resolveAiConfig(): AiConfig | null {
  const provider = process.env.STARFORGE_AI_PROVIDER as AiProvider | undefined
  const model = process.env.STARFORGE_AI_MODEL
  const baseUrl = process.env.STARFORGE_AI_BASE_URL
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (provider !== 'openai' && anthropicKey) {
    return { provider: 'anthropic', apiKey: anthropicKey, model: model || 'claude-haiku-4-5-20251001', baseUrl }
  }
  if (provider !== 'anthropic' && openaiKey) {
    return { provider: 'openai', apiKey: openaiKey, model: model || 'gpt-4o-mini', baseUrl }
  }
  return null
}

async function printLaunchKit(report: AuditReport, snapshot: RepoSnapshot): Promise<void> {
  const out = process.stdout
  const config = resolveAiConfig()
  if (!config) {
    out.write('\n--launch-kit needs an API key. Set ANTHROPIC_API_KEY or OPENAI_API_KEY (bring your own key).\n')
    return
  }

  out.write(`\nGenerating launch kit via ${config.provider} (${config.model})…\n`)
  const kit = await generateLaunchKit(config, report, snapshot)
  out.write(`\nTagline:\n  ${kit.tagline}\n`)
  out.write(`\nDescription:\n  ${kit.description}\n`)
  out.write(`\nTopics:\n  ${kit.topics.join(', ')}\n`)
  if (kit.readmeFixes.length > 0) {
    out.write('\nREADME fixes:\n')
    kit.readmeFixes.forEach((fix) => out.write(`  • ${fix.title}: ${fix.suggestion}\n`))
  }
  out.write(`\nLaunch post:\n${kit.launchPost}\n`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const snapshot = await loadSnapshot(options)
  const report = auditSnapshot(snapshot)

  if (options.checklist) {
    writeFileSync(join(options.cwd, 'STARFORGE_CHECKLIST.md'), renderChecklist(report))
  }

  if (options.card) {
    writeFileSync(join(options.cwd, 'starforge-card.svg'), renderCard(report, { theme: 'light' }))
    writeFileSync(join(options.cwd, 'starforge-card-dark.svg'), renderCard(report, { theme: 'dark' }))
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }

  const out = process.stdout
  out.write(`\nStarForge  ·  ${report.projectName} (${report.source})\n\n`)
  out.write(`  Score  ${report.score}/100   ${report.grade}\n`)
  out.write(`  ${report.summary}\n\n`)

  const labelWidth = Math.max(...report.categories.map((c) => c.label.length))
  for (const category of report.categories) {
    const label = category.label.padEnd(labelWidth)
    out.write(`  ${label}  ${bar(category.percent)} ${String(category.percent).padStart(3)}%\n`)
  }
  out.write('\n')

  if (report.checklist.length > 0) {
    out.write('Fix next:\n')
    report.checklist.forEach((fix) => out.write(`  • ${fix}\n`))
    out.write('\n')
  }

  const passed = report.items.filter((item) => item.passed).length
  out.write(`Passed ${passed}/${report.items.length} signals.\n`)

  if (options.card) {
    out.write('\nWrote starforge-card.svg (+ dark). Embed it in your README:\n\n')
    out.write(`${embedSnippet(report)}\n`)
  }

  const wrote = [
    options.checklist ? 'STARFORGE_CHECKLIST.md' : null,
    options.card ? 'starforge-card.svg' : null,
  ].filter(Boolean)
  if (wrote.length === 0 && !options.launchKit) {
    out.write('\nRun --card for an embeddable score card, --checklist for a plan, or --json for data.\n')
  }

  if (options.launchKit) {
    await printLaunchKit(report, snapshot)
  }
}

function printHelp() {
  process.stdout.write(
    `StarForge — audit a repo's launch readiness.\n\n` +
      `Usage:\n  starforge [--path ./repo] [--card] [--checklist] [--json]\n` +
      `  starforge owner/name [--card] [--json]   # audit any public repo\n\n` +
      `Options:\n` +
      `  -p, --path       Repository path to audit (default: current directory)\n` +
      `  -r, --repo       Audit a remote repo by owner/name (uses GITHUB_TOKEN if set)\n` +
      `      --card       Write an embeddable SVG score card (light + dark)\n` +
      `      --checklist  Write STARFORGE_CHECKLIST.md into the audited repo\n` +
      `      --launch-kit AI launch kit via your own key (ANTHROPIC_API_KEY / OPENAI_API_KEY)\n` +
      `      --json       Print the full structured report as JSON\n` +
      `  -h, --help       Show this help\n`,
  )
}

main().catch((error: unknown) => {
  const status = (error as GithubError).status
  if (status === 404) {
    process.stderr.write('Repository not found (or private without a token).\n')
  } else if (status === 403) {
    process.stderr.write('GitHub API rate limit hit. Set GITHUB_TOKEN to raise it.\n')
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  }
  process.exitCode = 1
})
