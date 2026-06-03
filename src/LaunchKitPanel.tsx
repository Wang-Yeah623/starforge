import { useEffect, useState } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { generateLaunchKit, type AiConfig, type AiProvider } from './ai/client'
import type { LaunchKit } from './ai/launch-kit'
import type { AuditReport } from './core/types'

const STORAGE_KEY = 'starforge-ai'

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
}

type Saved = { provider: AiProvider; model: string; baseUrl: string }

function loadSaved(): Saved {
  const fallback: Saved = { provider: 'anthropic', model: '', baseUrl: '' }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Saved>) } : fallback
  } catch {
    return fallback
  }
}

export function LaunchKitPanel({ report }: { report: AuditReport }) {
  const [provider, setProvider] = useState<AiProvider>(() => loadSaved().provider)
  const [model, setModel] = useState(() => loadSaved().model)
  const [baseUrl, setBaseUrl] = useState(() => loadSaved().baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [kit, setKit] = useState<LaunchKit | null>(null)

  // Persist non-secret preferences; the key stays in memory only.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, model, baseUrl }))
    } catch {
      /* storage unavailable */
    }
  }, [provider, model, baseUrl])

  const generate = async () => {
    if (!apiKey) {
      setStatus('error')
      setError('Enter your API key — it stays in your browser.')
      return
    }
    setStatus('loading')
    setError('')
    try {
      const config: AiConfig = {
        provider,
        apiKey,
        model: model || DEFAULT_MODELS[provider],
        baseUrl: baseUrl || undefined,
        allowBrowser: true,
      }
      setKit(await generateLaunchKit(config, report))
      setStatus('idle')
    } catch (caught) {
      setStatus('error')
      setError(caught instanceof Error ? caught.message : 'Generation failed.')
    }
  }

  return (
    <div className="panel wide">
      <div className="section-heading">
        <Wand2 size={22} aria-hidden="true" />
        <div>
          <h2>AI launch kit</h2>
          <p>Bring your own key. It never leaves your browser — it goes straight to the provider.</p>
        </div>
      </div>

      <div className="kit-fields">
        <div className="audit-input">
          <select value={provider} onChange={(event) => setProvider(event.target.value as AiProvider)} aria-label="Provider">
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI-compatible</option>
          </select>
        </div>
        <div className="audit-input">
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="API key"
            aria-label="API key"
            spellCheck={false}
          />
        </div>
        <div className="audit-input">
          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder={DEFAULT_MODELS[provider]}
            aria-label="Model"
            spellCheck={false}
          />
        </div>
        <div className="audit-input">
          <input
            type="text"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="Base URL (optional)"
            aria-label="Base URL"
            spellCheck={false}
          />
        </div>
        <button type="button" className="primary-action" onClick={() => void generate()} disabled={status === 'loading'}>
          {status === 'loading' ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Wand2 size={18} aria-hidden="true" />}
          Generate
        </button>
      </div>
      {status === 'error' && <p className="form-error">{error}</p>}

      {kit && (
        <div className="kit-result">
          <label className="embed-field">
            <span>Tagline</span>
            <code>{kit.tagline}</code>
          </label>
          <label className="embed-field">
            <span>Description</span>
            <code>{kit.description}</code>
          </label>
          {kit.topics.length > 0 && (
            <div className="embed-field">
              <span>Topics</span>
              <div className="topic-row">
                {kit.topics.map((topic) => (
                  <span className="topic-chip" key={topic}>
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
          {kit.readmeFixes.length > 0 && (
            <div className="embed-field">
              <span>README fixes</span>
              <ul className="kit-fixes">
                {kit.readmeFixes.map((fix) => (
                  <li key={fix.title}>
                    <strong>{fix.title}</strong> — {fix.suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kit.launchPost && (
            <label className="embed-field">
              <span>Launch post</span>
              <pre className="kit-post">{kit.launchPost}</pre>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
