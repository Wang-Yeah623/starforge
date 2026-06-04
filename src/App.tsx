import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Github,
  Megaphone,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  XCircle,
} from 'lucide-react'
import './App.css'
import { auditProject, generateLaunchPost, type ProjectInput } from './lib/audit'
import { fetchRepoInput } from './lib/github'

const sampleReadme = `# StarForge
A practical tool that helps maintainers prepare a GitHub launch with less guesswork.

![screenshot](./docs/screenshot.png)

## Quickstart
\`\`\`bash
npx starforge --path .
\`\`\`

## Features
- Audit README quality
- Generate launch checklists
- Export structured JSON

## Contributing
Good first issues are welcome.

## Launch
Share this with maintainers before release day.

## Roadmap
- Add badges
- Add release note templates

## License
MIT
`

const samplePackageJson = {
  description: 'Audit, polish, and launch GitHub projects.',
  keywords: ['github', 'open-source', 'readme', 'launch', 'stars'],
  license: 'MIT',
  scripts: { test: 'vitest run' },
}

const launchSteps = [
  'Tighten the first sentence until a stranger understands the project.',
  'Put a screenshot or terminal demo above the fold.',
  'Add install, test, and contribution commands people can trust.',
  'Prepare one short post for GitHub, X, Reddit, or Hacker News.',
]

const sampleInput: ProjectInput = {
  projectName: 'starforge',
  readme: sampleReadme,
  packageJson: samplePackageJson,
  hasLicenseFile: true,
  hasContributingFile: true,
  hasCi: true,
  hasChangelog: false,
  hasIssueTemplates: true,
}

function App() {
  const [readme, setReadme] = useState(sampleReadme)
  const [base, setBase] = useState<ProjectInput>(sampleInput)
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const input = useMemo(() => ({ ...base, readme }), [base, readme])
  const report = useMemo(() => auditProject(input), [input])
  const launchPost = useMemo(() => generateLaunchPost(report, input), [report, input])

  async function handleAudit(event: React.FormEvent) {
    event.preventDefault()
    if (!repoUrl.trim() || loading) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const fetched = await fetchRepoInput(repoUrl)
      setBase(fetched)
      setReadme(fetched.readme ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to audit that repository.')
    } finally {
      setLoading(false)
    }
  }

  const passed = report.items.filter((item) => item.passed)
  const failed = report.items.filter((item) => !item.passed)

  return (
    <main className="shell">
      <section className="hero-section">
        <nav className="topbar" aria-label="Primary navigation">
          <a className="brand" href="/">
            <Sparkles size={20} aria-hidden="true" />
            <span>StarForge</span>
          </a>
          <div className="nav-actions">
            <a href="https://github.com/new" target="_blank" rel="noreferrer">
              <Github size={18} aria-hidden="true" />
              New repo
            </a>
            <a href="#cli">
              <TerminalSquare size={18} aria-hidden="true" />
              CLI
            </a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <BadgeCheck size={18} aria-hidden="true" />
              GitHub launch readiness
            </p>
            <h1>Turn a quiet repo into a project people can understand, run, and share.</h1>
            <p className="lede">
              StarForge audits README quality, package metadata, launch assets,
              and contributor trust signals, then turns the gaps into a concrete
              checklist.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#try">
                Try it live
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <code>npx starforge --path .</code>
            </div>
          </div>

          <section className="score-panel" aria-label="Sample audit score">
            <div className="score-topline">
              <span>Sample repo</span>
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <strong>{report.score}</strong>
            <span className="score-label">/100 {report.grade}</span>
            <p>{report.summary}</p>
            <div className="score-meter" aria-hidden="true">
              <span style={{ width: `${report.score}%` }} />
            </div>
          </section>
        </div>
      </section>

      <section className="content-grid" id="try">
        <div className="panel wide">
          <div className="section-heading">
            <TerminalSquare size={22} aria-hidden="true" />
            <div>
              <h2>Try It Live</h2>
              <p>Audit any public GitHub repo, or paste a README below.</p>
            </div>
          </div>
          <form className="repo-form" onSubmit={handleAudit}>
            <input
              className="repo-input"
              type="text"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="owner/repo or https://github.com/owner/repo"
              aria-label="GitHub repository to audit"
            />
            <button className="primary-action" type="submit" disabled={loading}>
              <Github size={18} aria-hidden="true" />
              {loading ? 'Auditing…' : 'Audit repo'}
            </button>
          </form>
          {error ? <p className="repo-error">{error}</p> : null}
          <textarea
            className="readme-input"
            value={readme}
            onChange={(event) => setReadme(event.target.value)}
            spellCheck={false}
            aria-label="README content to audit"
          />
        </div>

        <aside className="panel">
          <div className="section-heading">
            <Megaphone size={22} aria-hidden="true" />
            <div>
              <h2>Launch Post</h2>
              <p>Auto-generated from your live score.</p>
            </div>
          </div>
          <pre className="launch-post">
            <code>{launchPost}</code>
          </pre>
        </aside>
      </section>

      <section className="content-grid" id="report">
        <div className="panel wide">
          <div className="section-heading">
            <ClipboardCheck size={22} aria-hidden="true" />
            <div>
              <h2>Audit Signals</h2>
              <p>Readable scoring for the things that make strangers trust a repo.</p>
            </div>
          </div>
          <div className="signal-list">
            {report.items.map((item) => (
              <article className="signal-row" key={item.id}>
                {item.passed ? (
                  <CheckCircle2 className="pass" size={21} aria-hidden="true" />
                ) : (
                  <XCircle className="fail" size={21} aria-hidden="true" />
                )}
                <div>
                  <h3>{item.label}</h3>
                  <p>{item.passed ? `Passed for +${item.points}` : item.fix}</p>
                </div>
                <span>
                  {item.points}/{item.maxPoints}
                </span>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel">
          <h2>Launch Checklist</h2>
          <ol className="checklist">
            {launchSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="content-grid bottom-grid">
        <div className="panel" id="cli">
          <h2>CLI First</h2>
          <pre>
            <code>{`npm install
npm run starforge -- --path . --checklist
npm test`}</code>
          </pre>
          <p>
            The CLI prints a score, writes a markdown checklist, and can emit JSON
            for bots or dashboards.
          </p>
        </div>

        <div className="panel">
          <h2>What Passed</h2>
          <p className="metric">{passed.length} signals</p>
          <p>Quickstart, demo, metadata, license, automation, and launch copy are ready.</p>
        </div>

        <div className="panel">
          <h2>What To Fix</h2>
          <p className="metric">{failed.length} gaps</p>
          <p>
            The best projects make remaining work obvious, small, and welcoming for
            contributors.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
