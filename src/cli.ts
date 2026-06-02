import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { auditProject, renderChecklist } from './lib/audit'

type CliOptions = {
  cwd: string
  json: boolean
  checklist: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    json: false,
    checklist: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--path' || arg === '-p') {
      options.cwd = resolve(argv[index + 1] || options.cwd)
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

function main() {
  const options = parseArgs(process.argv.slice(2))
  const readmePath = join(options.cwd, 'README.md')
  const packagePath = join(options.cwd, 'package.json')
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : ''
  const packageJson = readJson(packagePath)
  const projectName =
    typeof packageJson.name === 'string' ? packageJson.name : basename(options.cwd)
  const report = auditProject({ projectName, readme, packageJson })

  if (options.checklist) {
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
    failed.slice(0, 5).forEach((item) => {
      process.stdout.write(`- ${item.fix}\n`)
    })
    process.stdout.write('\n')
  }

  process.stdout.write('Run with --json for structured output or --checklist to write STARFORGE_CHECKLIST.md.\n')
}

function printHelp() {
  process.stdout.write(`StarForge\n\nUsage:\n  starforge [--path ./repo] [--json] [--checklist]\n\nOptions:\n  -p, --path       Repository path to audit\n      --json       Print structured JSON\n      --checklist  Write STARFORGE_CHECKLIST.md next to the project\n  -h, --help       Show this help\n`)
}

main()
