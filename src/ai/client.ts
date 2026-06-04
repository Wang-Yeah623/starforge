// Bring-your-own-key LLM client. The caller supplies the API key, so StarForge
// never pays and (in the browser) the key goes straight to the provider.
// Edge/browser/Node safe: uses only fetch.
import { buildLaunchKitPrompt, parseLaunchKit, type LaunchKit, type LaunchKitPrompt } from './launch-kit'
import type { AuditReport, RepoSnapshot } from '../core/types'

export type AiProvider = 'anthropic' | 'openai'

export type AiConfig = {
  provider: AiProvider
  apiKey: string
  model: string
  baseUrl?: string
  // Anthropic blocks browser calls unless this opt-in header is sent.
  allowBrowser?: boolean
}

const MAX_TOKENS = 1500

async function failure(response: Response, label: string): Promise<never> {
  const detail = await response.text().catch(() => '')
  throw new Error(`${label} API ${response.status}: ${detail}`.slice(0, 300))
}

async function completeAnthropic(config: AiConfig, prompt: LaunchKitPrompt): Promise<string> {
  const base = config.baseUrl ?? 'https://api.anthropic.com'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }
  if (config.allowBrowser) headers['anthropic-dangerous-direct-browser-access'] = 'true'

  const response = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      max_tokens: MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  })
  if (!response.ok) await failure(response, 'Anthropic')
  const data = (await response.json()) as { content?: Array<{ text?: string }> }
  return (data.content ?? []).map((block) => block.text ?? '').join('')
}

async function completeOpenAI(config: AiConfig, prompt: LaunchKitPrompt): Promise<string> {
  const base = config.baseUrl ?? 'https://api.openai.com/v1'
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  })
  if (!response.ok) await failure(response, 'OpenAI')
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

export async function complete(config: AiConfig, prompt: LaunchKitPrompt): Promise<string> {
  return config.provider === 'anthropic'
    ? completeAnthropic(config, prompt)
    : completeOpenAI(config, prompt)
}

export async function generateLaunchKit(
  config: AiConfig,
  report: AuditReport,
  snapshot?: RepoSnapshot,
): Promise<LaunchKit> {
  const text = await complete(config, buildLaunchKitPrompt(report, snapshot))
  return parseLaunchKit(text)
}
