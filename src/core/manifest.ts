// Pure, edge-safe manifest detection and parsing shared by every adapter.
// No Node, no DOM — just string in, structured metadata out.
import type { Ecosystem, RepoManifest } from './types'

export type DetectedManifest = { ecosystem: Ecosystem; manifestFile: string }

// Picks the canonical manifest from a repo's top-level file list.
export function detectManifest(files: string[]): DetectedManifest | null {
  const topLevel = new Set(files.filter((file) => !file.includes('/')))

  if (topLevel.has('package.json')) return { ecosystem: 'node', manifestFile: 'package.json' }

  const python = ['pyproject.toml', 'setup.cfg', 'setup.py'].find((file) => topLevel.has(file))
  if (python) return { ecosystem: 'python', manifestFile: python }

  if (topLevel.has('Cargo.toml')) return { ecosystem: 'rust', manifestFile: 'Cargo.toml' }
  if (topLevel.has('go.mod')) return { ecosystem: 'go', manifestFile: 'go.mod' }

  return null
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function tomlField(text: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"'\\n]+)["']`, 'mi').exec(text)
  return match?.[1]
}

function tomlArray(text: string, key: string): string[] | undefined {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'mi').exec(text)
  if (!match) return undefined
  const values = [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
  return values.length > 0 ? values : undefined
}

// Parses the manifest content into normalized metadata.
export function parseManifest(detected: DetectedManifest, text: string): RepoManifest {
  const { ecosystem, manifestFile } = detected

  if (ecosystem === 'node') {
    try {
      const pkg = JSON.parse(text) as Record<string, unknown>
      const scripts = (pkg.scripts ?? {}) as Record<string, unknown>
      return {
        ecosystem,
        manifestFile,
        name: str(pkg.name),
        description: str(pkg.description),
        license: typeof pkg.license === 'string' ? pkg.license : undefined,
        keywords: Array.isArray(pkg.keywords) ? (pkg.keywords as string[]) : undefined,
        homepage: str(pkg.homepage),
        hasTestScript: typeof scripts.test === 'string' && !/no test specified/i.test(scripts.test),
      }
    } catch {
      return { ecosystem, manifestFile }
    }
  }

  if (ecosystem === 'python' || ecosystem === 'rust') {
    return {
      ecosystem,
      manifestFile,
      name: tomlField(text, 'name'),
      description: tomlField(text, 'description'),
      license: tomlField(text, 'license'),
      keywords: tomlArray(text, 'keywords'),
    }
  }

  if (ecosystem === 'go') {
    const moduleLine = /^module\s+(\S+)/m.exec(text)?.[1]
    return {
      ecosystem,
      manifestFile,
      name: moduleLine ? moduleLine.split('/').pop() : undefined,
    }
  }

  return { ecosystem, manifestFile }
}
