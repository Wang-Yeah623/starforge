import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import {
  auditProject,
  generateBadges,
  generateLaunchPost,
  renderChecklist,
  type ProjectInput,
} from './lib/audit'
import { fetchRepoInput } from './lib/github'

type CliOptions = {
  cwd: string
  repo: string | null
  json: boolean
  checklist: boolean
  badges: boolean
  launch: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    repo: null,
    json: false,
    checklist: false,
    badges: false,
    launch: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--path' || arg === '-p') {
      options.cwd = resolve(argv[index + 1] || options.cwd)
      index += 1
      continue
    }

    if (arg === '--repo' || arg === '-r') {
      options.repo = argv[index + 1] || null
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

    if (arg === '--badges') {
      options.badges = true
      continue
    }

    if (arg === '--launch') {
      options.launch = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function readJson(path: string) {
  if (!existsSync(path)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Return true if any file in `dir` matches `pattern` (case-insensitive). */
function hasMatchingFile(dir: string, pattern: RegExp): boolean {
  if (!existsSync(dir)) {
    return false
  }

  try {
    return readdirSync(dir).some((name) => pattern.test(name))
  } catch {
    return false
  }
}

function inspectRepo(cwd: string): Omit<ProjectInput, 'projectName' | 'readme' | 'packageJson'> {
  const workflowsDir = join(cwd, '.github', 'workflows')
  const issueTemplateDir = join(cwd, '.github', 'ISSUE_TEMPLATE')

  return {
    hasLicenseFile: hasMatchingFile(cwd, /^licen[cs]e(\.|$)/i),
    hasContributingFile: hasMatchingFile(cwd, /^contributing(\.|$)/i),
    hasChangelog: hasMatchingFile(cwd, /^change(log|s)(\.|$)/i),
    hasCi:
      (existsSync(workflowsDir) && readdirSync(workflowsDir).length > 0) ||
      existsSync(join(cwd, '.gitlab-ci.yml')) ||
      existsSync(join(cwd, '.circleci')),
    hasIssueTemplates:
      existsSync(issueTemplateDir) ||
      hasMatchingFile(join(cwd, '.github'), /^pull_request_template(\.|$)/i),
  }
}

function readLocalInput(cwd: string): ProjectInput {
  const readmePath = join(cwd, 'README.md')
  const packagePath = join(cwd, 'package.json')
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : ''
  const packageJson = readJson(packagePath)
  const projectName =
    typeof packageJson.name === 'string' ? packageJson.name : basename(cwd)

  return {
    projectName,
    readme,
    packageJson,
    ...inspectRepo(cwd),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  const input = options.repo
    ? await fetchRepoInput(options.repo)
    : readLocalInput(options.cwd)
  const report = auditProject(input)

  if (options.checklist && !options.repo) {
    writeFileSync(join(options.cwd, 'STARFORGE_CHECKLIST.md'), renderChecklist(report))
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }

  const failed = report.items.filter((item) => !item.passed)

  process.stdout.write(`\nStarForge score: ${report.score}/100 (${report.grade})\n`)
  process.stdout.write(`${report.summary}\n\n`)

  if (failed.length > 0) {
    process.stdout.write('Fix next:\n')
    failed.slice(0, 6).forEach((item) => {
      process.stdout.write(`- ${item.fix}\n`)
    })
    process.stdout.write('\n')
  }

  if (options.badges) {
    process.stdout.write('Badges:\n')
    generateBadges(input).forEach((badge) => process.stdout.write(`${badge}\n`))
    process.stdout.write('\n')
  }

  if (options.launch) {
    process.stdout.write('Launch post:\n')
    process.stdout.write(`${generateLaunchPost(report, input)}\n\n`)
  }

  process.stdout.write(
    'Run with --json, --checklist, --badges, or --launch for more output.\n',
  )
}

function printHelp() {
  process.stdout.write(`StarForge\n\nUsage:\n  starforge [--path ./repo] [--repo owner/name] [--json] [--checklist] [--badges] [--launch]\n\nOptions:\n  -p, --path       Local repository path to audit\n  -r, --repo       Audit a public GitHub repo (owner/name or URL)\n      --json       Print structured JSON\n      --checklist  Write STARFORGE_CHECKLIST.md next to the project\n      --badges     Print copy-pasteable shields.io badges\n      --launch     Print a shareable launch post draft\n  -h, --help       Show this help\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`StarForge error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
