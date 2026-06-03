import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Github,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  XCircle,
} from 'lucide-react'
import './App.css'
import { auditSnapshot } from './core/audit'
import { renderCard } from './card/card'
import { LaunchKitPanel } from './LaunchKitPanel'
import type { AuditReport, RepoSnapshot } from './core/types'

const sampleReadme = `# StarForge
A practical tool that helps maintainers prepare a GitHub launch with less guesswork.

![build](https://img.shields.io/badge/build-passing-green)
![screenshot](./docs/screenshot.png)

## Quickstart
\`\`\`bash
npx starforge --path .
\`\`\`

## Contributing
Good first issues are welcome.
`

const sampleSnapshot: RepoSnapshot = {
  name: 'starforge',
  source: 'local',
  readme: { filename: 'README.md', text: sampleReadme },
  files: [
    'README.md',
    'LICENSE',
    'CONTRIBUTING.md',
    'package.json',
    '.github/workflows/ci.yml',
    'docs/screenshot.png',
    'src/cli.ts',
    'src/core/audit.test.ts',
  ],
  manifest: {
    ecosystem: 'node',
    manifestFile: 'package.json',
    name: 'starforge',
    description: 'Audit, polish, and launch GitHub projects.',
    keywords: ['github', 'open-source', 'readme', 'launch', 'stars'],
    license: 'MIT',
    hasTestScript: true,
  },
  git: { ageDays: 1, tagCount: 1 },
}

const sampleReport = auditSnapshot(sampleSnapshot)
const sampleCardSvg = renderCard(sampleReport)

function parseSlug(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
  return /^[\w.-]+\/[\w.-]+$/.test(cleaned) ? cleaned : null
}

function App() {
  const [repoInput, setRepoInput] = useState(
    () => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('repo') ?? ''),
  )
  const [report, setReport] = useState<AuditReport>(sampleReport)
  const [audited, setAudited] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const runAudit = useCallback(async (raw: string) => {
    const slug = parseSlug(raw)
    if (!slug) {
      setStatus('error')
      setErrorMsg('Enter a repository as owner/name.')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const response = await fetch(`/api/report?repo=${encodeURIComponent(slug)}`)
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Live audits run on the deployed site (or via `vercel dev`).')
      }
      const data = (await response.json()) as AuditReport & { error?: string }
      if (!response.ok || data.error) throw new Error(data.error ?? 'Audit failed.')
      setReport(data)
      setAudited(slug)
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      setErrorMsg(error instanceof Error ? error.message : 'Audit failed.')
    }
  }, [])

  useEffect(() => {
    // Deep-link support: ?repo=owner/name auto-runs the audit on load, which is
    // how the embeddable card links back into a live report. Fetching on mount
    // is a legitimate effect.
    const repo = new URLSearchParams(window.location.search).get('repo')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (repo) void runAudit(repo)
  }, [runAudit])

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const cardUrl = audited ? `${origin}/api/card?repo=${audited}` : ''
  const reportUrl = audited ? `${origin}/?repo=${audited}` : ''
  const cardMarkdown = audited ? `[![StarForge](${cardUrl})](${reportUrl})` : ''
  const badgeMarkdown = audited
    ? `[![StarForge](https://img.shields.io/endpoint?url=${encodeURIComponent(
        `${origin}/api/badge?repo=${audited}`,
      )})](${reportUrl})`
    : ''

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
            <a href="https://github.com/Wang-Yeah623/starforge" target="_blank" rel="noreferrer">
              <Github size={18} aria-hidden="true" />
              GitHub
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
              StarForge audits README quality, package metadata, launch assets, and
              contributor trust signals, then turns the gaps into a concrete checklist —
              with an embeddable score card you can drop in any README.
            </p>

            <form className="audit-form" onSubmit={(event) => { event.preventDefault(); void runAudit(repoInput) }}>
              <div className="audit-input">
                <Search size={18} aria-hidden="true" />
                <input
                  type="text"
                  value={repoInput}
                  onChange={(event) => setRepoInput(event.target.value)}
                  placeholder="owner/name  ·  e.g. sindresorhus/slugify"
                  aria-label="GitHub repository to audit"
                  spellCheck={false}
                />
              </div>
              <button type="submit" className="primary-action" disabled={status === 'loading'}>
                {status === 'loading' ? (
                  <Loader2 size={18} className="spin" aria-hidden="true" />
                ) : (
                  <ArrowUpRight size={18} aria-hidden="true" />
                )}
                Audit
              </button>
            </form>
            {status === 'error' && <p className="form-error">{errorMsg}</p>}
            <code className="hero-hint">npx starforge owner/name</code>
          </div>

          <section className="score-panel" aria-label="Score card">
            <div className="score-topline">
              <span>{audited ?? 'Sample repo'}</span>
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            {audited ? (
              <img className="card-img" src={`/api/card?repo=${audited}`} alt={`StarForge score for ${audited}`} />
            ) : (
              <div className="card-embed" dangerouslySetInnerHTML={{ __html: sampleCardSvg }} />
            )}
            <p className="card-caption">
              {audited
                ? 'This card is live — it re-audits automatically. Embed it below.'
                : 'Audit a repo above to generate its live, embeddable score card.'}
            </p>
          </section>
        </div>
      </section>

      {audited && (
        <section className="content-grid" aria-label="Embed snippets">
          <div className="panel wide embed-panel">
            <div className="section-heading">
              <ClipboardCheck size={22} aria-hidden="true" />
              <div>
                <h2>Embed the card</h2>
                <p>Paste into your README. Every embed links back to this report.</p>
              </div>
            </div>
            <label className="embed-field">
              <span>Score card</span>
              <code>{cardMarkdown}</code>
            </label>
            <label className="embed-field">
              <span>Shields badge</span>
              <code>{badgeMarkdown}</code>
            </label>
          </div>
        </section>
      )}

      <section className="content-grid" id="report">
        <div className="panel wide">
          <div className="section-heading">
            <ClipboardCheck size={22} aria-hidden="true" />
            <div>
              <h2>Audit signals — {report.score}/100 · {report.grade}</h2>
              <p>{report.summary}</p>
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
                  <p>{item.passed ? item.detail ?? `Passed for +${item.points}` : item.fix}</p>
                </div>
                <span>
                  {item.points}/{item.maxPoints}
                </span>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel">
          <h2>By category</h2>
          <div className="category-list">
            {report.categories.map((category) => (
              <div className="category-row" key={category.id}>
                <div className="category-top">
                  <span>{category.label}</span>
                  <strong>{category.percent}%</strong>
                </div>
                <div className="category-meter" aria-hidden="true">
                  <span style={{ width: `${category.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="content-grid" aria-label="AI launch kit">
        <LaunchKitPanel report={report} />
      </section>

      <section className="content-grid bottom-grid">
        <div className="panel" id="cli">
          <h2>CLI First</h2>
          <pre>
            <code>{`npx starforge owner/name      # audit any public repo
npx starforge --path . --card # write an embeddable card`}</code>
          </pre>
          <p>The CLI prints a score, writes a markdown checklist, and emits JSON for bots.</p>
        </div>

        <div className="panel">
          <h2>What Passed</h2>
          <p className="metric">{passed.length} signals</p>
          <p>Clear positioning, runnable quickstart, trust signals, and discovery metadata.</p>
        </div>

        <div className="panel">
          <h2>What To Fix</h2>
          <p className="metric">{failed.length} gaps</p>
          <p>The best projects make remaining work obvious, small, and welcoming.</p>
        </div>
      </section>
    </main>
  )
}

export default App
