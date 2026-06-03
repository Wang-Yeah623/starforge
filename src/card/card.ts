// Pure SVG renderer: AuditReport -> an embeddable score card.
// No Node, no DOM. Safe to import from the CLI, a serverless function, or the
// browser. This is StarForge's growth engine: a card maintainers proudly embed
// in their README, where every embed links back to the project.
import type { AuditReport, Grade } from '../core/types'

export type CardTheme = 'light' | 'dark'

export type CardOptions = {
  theme?: CardTheme
}

const GRADE_COLOR: Record<Grade, string> = {
  'Launch-ready': '#2F8F4E',
  Promising: '#C9952E',
  'Needs polish': '#C2553B',
}

const PALETTE = {
  light: { bg: '#FFFFFF', border: '#D9DED1', text: '#17231B', sub: '#5B6B5E', track: '#E8ECE4' },
  dark: { bg: '#0D1117', border: '#26302A', text: '#EAF2EA', sub: '#93A699', track: '#20271E' },
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;'
    if (ch === '<') return '&lt;'
    if (ch === '>') return '&gt;'
    if (ch === '"') return '&quot;'
    return '&#39;'
  })
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function renderCard(report: AuditReport, options: CardOptions = {}): string {
  const theme = options.theme === 'dark' ? PALETTE.dark : PALETTE.light
  const accent = GRADE_COLOR[report.grade]
  const width = 460
  const height = 185
  const title = escapeXml(report.projectName)

  // Overall score ring (top-left), the iconic shareable element.
  const cx = 78
  const cy = 112
  const r = 40
  const stroke = 10
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - clampPercent(report.score) / 100)

  // Category bars (right column).
  const barX = 162
  const barW = 272
  const rowTop = 66
  const rowGap = 27
  const barH = 7
  const rows = report.categories
    .map((category, index) => {
      const y = rowTop + index * rowGap
      const fill = Math.round((clampPercent(category.percent) / 100) * barW)
      return [
        `<text x="${barX}" y="${y}" font-size="12" font-weight="600" fill="${theme.text}">${escapeXml(category.label)}</text>`,
        `<text x="${barX + barW}" y="${y}" text-anchor="end" font-size="12" fill="${theme.sub}">${category.percent}%</text>`,
        `<rect x="${barX}" y="${y + 6}" width="${barW}" height="${barH}" rx="${barH / 2}" fill="${theme.track}"/>`,
        `<rect x="${barX}" y="${y + 6}" width="${fill}" height="${barH}" rx="${barH / 2}" fill="${accent}"/>`,
      ].join('')
    })
    .join('')

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title} StarForge score: ${report.score} out of 100, ${report.grade}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="14" fill="${theme.bg}" stroke="${theme.border}"/>
  <g font-family="${FONT}">
    <text x="24" y="34" font-size="13" font-weight="700" fill="${theme.text}">★ StarForge</text>
    <text x="${width - 24}" y="34" text-anchor="end" font-size="13" fill="${theme.sub}">${title}</text>
    <line x1="24" y1="46" x2="${width - 24}" y2="46" stroke="${theme.border}"/>

    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${theme.track}" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="30" font-weight="800" fill="${theme.text}">${report.score}</text>
    <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="11" fill="${theme.sub}">/ 100</text>
    <text x="${cx}" y="${height - 18}" text-anchor="middle" font-size="12" font-weight="700" fill="${accent}">${escapeXml(report.grade)}</text>

    ${rows}
  </g>
</svg>
`
}

// A zero-infra Markdown badge via the shields.io static endpoint.
export function badgeUrl(report: AuditReport): string {
  const color = GRADE_COLOR[report.grade].replace('#', '')
  const label = 'StarForge'
  const message = `${report.score}/100`
  return `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(message)}-${color}`
}

// The snippet a maintainer pastes into their README.
export function embedSnippet(report: AuditReport, cardPath = './starforge-card.svg'): string {
  return [
    `![StarForge: ${report.score}/100 ${report.grade}](${cardPath})`,
    '',
    `[![StarForge score](${badgeUrl(report)})](https://github.com/Wang-Yeah623/starforge)`,
  ].join('\n')
}
