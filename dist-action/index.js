// src/action/index.ts
import { appendFileSync, readFileSync as readFileSync2, writeFileSync } from "fs";
import { join as join2, resolve } from "path";

// src/core/audit.ts
var CATEGORY_LABELS = {
  "first-impression": "First impression",
  runnability: "Runnability",
  trust: "Trust & quality",
  growth: "Growth & community"
};
var RECENCY_WINDOW_DAYS = 180;
function readmeText(snapshot) {
  return snapshot.readme?.text ?? "";
}
function basenameOf(path) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}
function hasFile(snapshot, matcher) {
  return snapshot.files.some((file) => matcher.test(file));
}
function hasBasename(snapshot, matcher) {
  return snapshot.files.some((file) => matcher.test(basenameOf(file)));
}
function truncate(text, max) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}\u2026` : clean;
}
var rules = [
  {
    id: "positioning",
    category: "first-impression",
    label: "README opens with a clear one-sentence promise",
    maxPoints: 12,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot).trim();
      if (!text) return { passed: false, detail: "No README found." };
      const lines = text.split(/\r?\n/);
      const h1Index = lines.findIndex((line) => /^#\s+\S/.test(line));
      if (h1Index === -1) return { passed: false, detail: "No top-level H1 heading." };
      for (let i = h1Index + 1; i < Math.min(lines.length, h1Index + 8); i += 1) {
        const line = lines[i].trim();
        if (!line) continue;
        if (/^!\[/.test(line) || /^<img/i.test(line)) continue;
        if (/shields\.io|img\.shields|badge/i.test(line)) continue;
        if (/^#{1,6}\s/.test(line)) break;
        const plain = line.replace(/[*_`>#[\]()]/g, "").trim();
        if (plain.length >= 40 && plain.length <= 260) {
          return { passed: true, detail: truncate(plain, 96) };
        }
        return {
          passed: false,
          detail: "First line under the title is too short to explain the project."
        };
      }
      return { passed: false, detail: "No description under the title." };
    },
    fix: "Add one concrete sentence right under the H1: who it helps and what it does."
  },
  {
    id: "quickstart",
    category: "runnability",
    label: "Quickstart is visible and copy-pasteable",
    maxPoints: 12,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot);
      const hasHeading = /(^|\n)#{1,6}\s.*(install|quick ?start|getting started|usage|setup|run)\b/i.test(text);
      const hasFence = /```/.test(text);
      if (hasHeading && hasFence) return { passed: true };
      if (hasFence) return { passed: false, detail: "Has code blocks but no install/usage heading." };
      return { passed: false, detail: "No fenced command block found." };
    },
    fix: "Add an Install/Quickstart section with copy-pasteable commands in a fenced code block."
  },
  {
    id: "visual-demo",
    category: "first-impression",
    label: "A demo, screenshot, or preview is present",
    maxPoints: 9,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot);
      const images = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1]);
      const htmlImg = /<img\s[^>]*src=["']?([^"'>\s]+)/i.exec(text)?.[1];
      const candidates = [...images, htmlImg].filter(Boolean);
      const realImage = candidates.find((src) => !/shields\.io|img\.shields|badge/i.test(src));
      if (realImage) return { passed: true, detail: truncate(realImage, 60) };
      const demoLink = /\b(live demo|demo|playground|try it online|screencast|video)\b/i.test(text);
      if (demoLink) return { passed: true, detail: "Demo / video link in README." };
      const asset = hasFile(snapshot, /\.(png|jpe?g|gif|webp|mp4|mov|svg)$/i) && hasFile(snapshot, /(screenshot|demo|preview|hero|banner|docs\/)/i);
      if (asset) return { passed: true, detail: "Preview asset detected in repo." };
      return { passed: false };
    },
    fix: "Add a screenshot, GIF, hosted demo, or terminal preview near the top of the README."
  },
  {
    id: "badges",
    category: "first-impression",
    label: "Status badges build instant trust",
    maxPoints: 4,
    evaluate: (snapshot) => {
      const text = readmeText(snapshot);
      const passed = /img\.shields\.io|badgen\.net|!\[[^\]]*\]\([^)]*\/badge\/[^)]*\)/i.test(text);
      return { passed };
    },
    fix: "Add CI, license, version, or downloads badges under the title via shields.io."
  },
  {
    id: "buildable",
    category: "runnability",
    label: "A recognizable package manifest exists",
    maxPoints: 6,
    evaluate: (snapshot) => {
      if (snapshot.manifest) {
        return {
          passed: true,
          detail: `${snapshot.manifest.ecosystem} \xB7 ${snapshot.manifest.manifestFile}`
        };
      }
      return { passed: false, detail: "No package.json / pyproject / Cargo.toml / go.mod found." };
    },
    fix: "Add a standard manifest so people know how to install and what ecosystem this is."
  },
  {
    id: "license",
    category: "trust",
    label: "A license is declared",
    maxPoints: 10,
    evaluate: (snapshot) => {
      const file = snapshot.files.find(
        (f) => /^(licen[sc]e|copying|unlicense)(\.[a-z]+)?$/i.test(basenameOf(f))
      );
      if (file) return { passed: true, detail: `${file} present` };
      const manifestLicense = snapshot.manifest?.license;
      if (manifestLicense) return { passed: true, detail: `${manifestLicense} (manifest)` };
      const ghLicense = snapshot.github?.license;
      if (ghLicense) return { passed: true, detail: `${ghLicense} (GitHub)` };
      return { passed: false };
    },
    fix: "Add a LICENSE file (MIT, Apache-2.0, ...) so others know how they may use the code."
  },
  {
    id: "tests",
    category: "trust",
    label: "Automated tests exist",
    maxPoints: 9,
    evaluate: (snapshot) => {
      const testFile = hasFile(
        snapshot,
        /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.go$|(^|\/)test_[^/]+\.py$/i
      );
      if (testFile) return { passed: true, detail: "Test files detected." };
      if (snapshot.manifest?.hasTestScript) return { passed: true, detail: "Test script in manifest." };
      return { passed: false };
    },
    fix: "Add a test suite (even a small one) and a `test` command so contributors trust changes."
  },
  {
    id: "ci",
    category: "trust",
    label: "Continuous integration is configured",
    maxPoints: 8,
    evaluate: (snapshot) => {
      const ghAction = hasFile(snapshot, /^\.github\/workflows\/[^/]+\.ya?ml$/i);
      if (ghAction) return { passed: true, detail: "GitHub Actions workflow found." };
      const otherCi = hasFile(
        snapshot,
        /^(\.gitlab-ci\.yml|\.travis\.yml|\.drone\.yml|azure-pipelines\.yml|jenkinsfile)$|^\.circleci\//i
      );
      if (otherCi) return { passed: true, detail: "CI config found." };
      return { passed: false };
    },
    fix: "Add a CI workflow that runs build/lint/test on every push and pull request."
  },
  {
    id: "recency",
    category: "trust",
    label: "The project shows recent activity",
    maxPoints: 7,
    evaluate: (snapshot) => {
      const days = snapshot.git?.ageDays;
      if (days === void 0) return { passed: false, detail: "No commit date available." };
      if (days <= RECENCY_WINDOW_DAYS) return { passed: true, detail: `Last commit ~${days}d ago` };
      return { passed: false, detail: `Last commit ~${days}d ago` };
    },
    fix: "Make a small recent commit; a stale repo reads as abandoned to first-time visitors."
  },
  {
    id: "community-health",
    category: "trust",
    label: "Community health files are present",
    maxPoints: 5,
    evaluate: (snapshot) => {
      const has = hasBasename(snapshot, /^(code_of_conduct|security|support|funding)\.(md|ya?ml)$/i) || hasFile(snapshot, /^\.github\/(issue_template|pull_request_template)/i);
      return { passed: has };
    },
    fix: "Add a SECURITY.md, CODE_OF_CONDUCT.md, or issue/PR templates to signal a healthy project."
  },
  {
    id: "metadata",
    category: "growth",
    label: "Package metadata helps discovery",
    maxPoints: 7,
    evaluate: (snapshot) => {
      const description = snapshot.manifest?.description || snapshot.github?.description;
      const keywordCount = (snapshot.manifest?.keywords?.length ?? 0) || (snapshot.github?.topics?.length ?? 0);
      if (description && keywordCount >= 3) {
        return { passed: true, detail: `${keywordCount} keywords/topics` };
      }
      if (!description) return { passed: false, detail: "No description in manifest or repo settings." };
      return { passed: false, detail: `Only ${keywordCount} keywords/topics (need 3+).` };
    },
    fix: "Add a precise description and at least 3 searchable keywords / GitHub topics."
  },
  {
    id: "contributing",
    category: "growth",
    label: "A welcoming contribution path exists",
    maxPoints: 7,
    evaluate: (snapshot) => {
      const file = hasBasename(snapshot, /^contributing\.(md|rst|txt)$/i);
      const template = hasFile(snapshot, /^\.github\/(issue_template|pull_request_template)/i);
      const inReadme = /#{1,6}\s.*contribut|good first issue/i.test(readmeText(snapshot));
      return { passed: file || template || inReadme };
    },
    fix: "Add a CONTRIBUTING.md or a README section with setup steps and good first issues."
  },
  {
    id: "releases",
    category: "growth",
    label: "Releases or a changelog show momentum",
    maxPoints: 6,
    evaluate: (snapshot) => {
      const changelog = hasBasename(snapshot, /^(changelog|changes|history)\.(md|rst|txt)$/i);
      if (changelog) return { passed: true, detail: "CHANGELOG present." };
      if (snapshot.github?.hasReleases) return { passed: true, detail: "GitHub releases found." };
      if ((snapshot.git?.tagCount ?? 0) > 0) {
        return { passed: true, detail: `${snapshot.git?.tagCount} git tags` };
      }
      return { passed: false };
    },
    fix: "Cut a tagged release or add a CHANGELOG so people can see the project is evolving."
  }
];
function gradeFor(score) {
  if (score >= 82) return "Launch-ready";
  if (score >= 58) return "Promising";
  return "Needs polish";
}
function summarize(score, items) {
  const misses = items.filter((item) => !item.passed).length;
  if (score >= 82) {
    return `Strong launch shape. ${misses} signal${misses === 1 ? "" : "s"} left before sharing widely.`;
  }
  if (score >= 58) {
    return "Good foundation. Close the highest-weight gaps before asking strangers for attention.";
  }
  return "Needs clearer positioning and trust signals before launch. Start with the top fixes below.";
}
function buildCategories(items) {
  const order = ["first-impression", "runnability", "trust", "growth"];
  return order.map((id) => {
    const inCategory = items.filter((item) => item.category === id);
    const points = inCategory.reduce((sum, item) => sum + item.points, 0);
    const maxPoints = inCategory.reduce((sum, item) => sum + item.maxPoints, 0);
    return {
      id,
      label: CATEGORY_LABELS[id],
      points,
      maxPoints,
      percent: maxPoints === 0 ? 0 : Math.round(points / maxPoints * 100)
    };
  });
}
function auditSnapshot(snapshot) {
  const items = rules.map((rule) => {
    const result = rule.evaluate(snapshot);
    return {
      id: rule.id,
      category: rule.category,
      label: rule.label,
      passed: result.passed,
      points: result.passed ? rule.maxPoints : 0,
      maxPoints: rule.maxPoints,
      fix: rule.fix,
      detail: result.detail
    };
  });
  const totalPoints = items.reduce((sum, item) => sum + item.points, 0);
  const totalMax = items.reduce((sum, item) => sum + item.maxPoints, 0);
  const score = totalMax === 0 ? 0 : Math.round(totalPoints / totalMax * 100);
  const checklist = items.filter((item) => !item.passed).sort((a, b) => b.maxPoints - a.maxPoints).slice(0, 6).map((item) => item.fix);
  return {
    projectName: snapshot.name,
    source: snapshot.source,
    score,
    grade: gradeFor(score),
    summary: summarize(score, items),
    items,
    categories: buildCategories(items),
    checklist
  };
}

// src/adapters/local.ts
import { execFileSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import { basename, join, relative, sep } from "path";

// src/core/manifest.ts
function detectManifest(files) {
  const topLevel = new Set(files.filter((file) => !file.includes("/")));
  if (topLevel.has("package.json")) return { ecosystem: "node", manifestFile: "package.json" };
  const python = ["pyproject.toml", "setup.cfg", "setup.py"].find((file) => topLevel.has(file));
  if (python) return { ecosystem: "python", manifestFile: python };
  if (topLevel.has("Cargo.toml")) return { ecosystem: "rust", manifestFile: "Cargo.toml" };
  if (topLevel.has("go.mod")) return { ecosystem: "go", manifestFile: "go.mod" };
  return null;
}
function str(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function tomlField(text, key) {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"'\\n]+)["']`, "mi").exec(text);
  return match?.[1];
}
function tomlArray(text, key) {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, "mi").exec(text);
  if (!match) return void 0;
  const values = [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  return values.length > 0 ? values : void 0;
}
function parseManifest(detected, text) {
  const { ecosystem, manifestFile } = detected;
  if (ecosystem === "node") {
    try {
      const pkg = JSON.parse(text);
      const scripts = pkg.scripts ?? {};
      return {
        ecosystem,
        manifestFile,
        name: str(pkg.name),
        description: str(pkg.description),
        license: typeof pkg.license === "string" ? pkg.license : void 0,
        keywords: Array.isArray(pkg.keywords) ? pkg.keywords : void 0,
        homepage: str(pkg.homepage),
        hasTestScript: typeof scripts.test === "string" && !/no test specified/i.test(scripts.test)
      };
    } catch {
      return { ecosystem, manifestFile };
    }
  }
  if (ecosystem === "python" || ecosystem === "rust") {
    return {
      ecosystem,
      manifestFile,
      name: tomlField(text, "name"),
      description: tomlField(text, "description"),
      license: tomlField(text, "license"),
      keywords: tomlArray(text, "keywords")
    };
  }
  if (ecosystem === "go") {
    const moduleLine = /^module\s+(\S+)/m.exec(text)?.[1];
    return {
      ecosystem,
      manifestFile,
      name: moduleLine ? moduleLine.split("/").pop() : void 0
    };
  }
  return { ecosystem, manifestFile };
}

// src/adapters/local.ts
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-cli",
  "dist-ssr",
  "build",
  "out",
  "target",
  "vendor",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".venv",
  "venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  "coverage",
  ".turbo",
  ".cache"
]);
var MAX_DEPTH = 3;
function listFiles(root) {
  const out = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (depth >= MAX_DEPTH) continue;
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        out.push(relative(root, full).split(sep).join("/"));
      }
    }
  };
  walk(root, 0);
  return out;
}
function readFileSafe(root, relPath) {
  try {
    return readFileSync(join(root, relPath), "utf8");
  } catch {
    return void 0;
  }
}
function findReadme(files) {
  return files.find(
    (file) => !file.includes("/") && /^readme(\.(md|markdown|rst|txt))?$/i.test(file)
  );
}
function readManifest(root, files) {
  const detected = detectManifest(files);
  if (!detected) return null;
  const text = readFileSafe(root, detected.manifestFile) ?? "";
  return parseManifest(detected, text);
}
function git(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return void 0;
  }
}
function readGit(root) {
  const lastCommitISO = git(root, ["log", "-1", "--format=%cI"]);
  const ageDays = lastCommitISO ? Math.max(0, Math.floor((Date.now() - Date.parse(lastCommitISO)) / 864e5)) : void 0;
  const tags = git(root, ["tag"]);
  const tagCount = tags ? tags.split("\n").filter(Boolean).length : void 0;
  if (lastCommitISO === void 0 && tagCount === void 0) return void 0;
  return { lastCommitISO, ageDays, tagCount };
}
function snapshotFromLocal(root) {
  const files = listFiles(root);
  const readmePath = findReadme(files);
  const readme = readmePath ? { filename: readmePath, text: readFileSafe(root, readmePath) ?? "" } : null;
  const manifest = readManifest(root, files);
  const name = manifest?.name || basename(root) || "project";
  return {
    name,
    source: "local",
    readme,
    files,
    manifest,
    git: readGit(root)
  };
}

// src/card/card.ts
var GRADE_COLOR = {
  "Launch-ready": "#2F8F4E",
  Promising: "#C9952E",
  "Needs polish": "#C2553B"
};
var PALETTE = {
  light: { bg: "#FFFFFF", border: "#D9DED1", text: "#17231B", sub: "#5B6B5E", track: "#E8ECE4" },
  dark: { bg: "#0D1117", border: "#26302A", text: "#EAF2EA", sub: "#93A699", track: "#20271E" }
};
var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
function escapeXml(value) {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}
function clampPercent(value) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
function renderCard(report, options = {}) {
  const theme = options.theme === "dark" ? PALETTE.dark : PALETTE.light;
  const accent = GRADE_COLOR[report.grade];
  const width = 460;
  const height = 185;
  const title = escapeXml(report.projectName);
  const cx = 78;
  const cy = 112;
  const r = 40;
  const stroke = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clampPercent(report.score) / 100);
  const barX = 162;
  const barW = 272;
  const rowTop = 66;
  const rowGap = 27;
  const barH = 7;
  const rows = report.categories.map((category, index) => {
    const y = rowTop + index * rowGap;
    const fill = Math.round(clampPercent(category.percent) / 100 * barW);
    return [
      `<text x="${barX}" y="${y}" font-size="12" font-weight="600" fill="${theme.text}">${escapeXml(category.label)}</text>`,
      `<text x="${barX + barW}" y="${y}" text-anchor="end" font-size="12" fill="${theme.sub}">${category.percent}%</text>`,
      `<rect x="${barX}" y="${y + 6}" width="${barW}" height="${barH}" rx="${barH / 2}" fill="${theme.track}"/>`,
      `<rect x="${barX}" y="${y + 6}" width="${fill}" height="${barH}" rx="${barH / 2}" fill="${accent}"/>`
    ].join("");
  }).join("");
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title} StarForge score: ${report.score} out of 100, ${report.grade}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="14" fill="${theme.bg}" stroke="${theme.border}"/>
  <g font-family="${FONT}">
    <text x="24" y="34" font-size="13" font-weight="700" fill="${theme.text}">\u2605 StarForge</text>
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
`;
}

// src/action/report-comment.ts
var COMMENT_MARKER = "<!-- starforge -->";
var REPO_URL = "https://github.com/Wang-Yeah623/starforge";
function bar(percent) {
  const filled = Math.round(percent / 10);
  return `${"\u2588".repeat(filled)}${"\u2591".repeat(10 - filled)}`;
}
function renderComment(report) {
  const emoji = report.score >= 82 ? "\u{1F7E2}" : report.score >= 58 ? "\u{1F7E1}" : "\u{1F534}";
  const categoryRows = report.categories.map((category) => `| ${category.label} | \`${bar(category.percent)}\` | ${category.percent}% |`).join("\n");
  const fixes = report.checklist.length > 0 ? report.checklist.map((fix) => `- ${fix}`).join("\n") : "- Nothing blocking \u2014 this repo is launch-ready. \u{1F680}";
  return [
    COMMENT_MARKER,
    `## ${emoji} StarForge \u2014 ${report.score}/100 \xB7 ${report.grade}`,
    "",
    report.summary,
    "",
    "| Category | | |",
    "| :-- | :-- | --: |",
    categoryRows,
    "",
    "**Fix next**",
    "",
    fixes,
    "",
    `<sub>Generated by <a href="${REPO_URL}">StarForge</a>. Push a commit to refresh.</sub>`
  ].join("\n");
}

// src/action/index.ts
function getInput(name, fallback = "") {
  const key = `INPUT_${name.toUpperCase().replace(/ /g, "_")}`;
  const value = process.env[key];
  return (value === void 0 || value === "" ? fallback : value).trim();
}
function isFalse(value) {
  return value.toLowerCase() === "false";
}
function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}
`);
}
var API = "https://api.github.com";
async function upsertComment(token, repoFull, issueNumber, body) {
  const [owner, repo] = repoFull.split("/");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "starforge-action",
    "Content-Type": "application/json"
  };
  const listResponse = await fetch(
    `${API}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    { headers }
  );
  const comments = listResponse.ok ? await listResponse.json() : [];
  const existing = Array.isArray(comments) ? comments.find((comment) => typeof comment.body === "string" && comment.body.includes(COMMENT_MARKER)) : void 0;
  if (existing) {
    await fetch(`${API}/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body })
    });
  } else {
    await fetch(`${API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body })
    });
  }
}
async function run() {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const root = resolve(workspace, getInput("path", ".") || ".");
  const report = auditSnapshot(snapshotFromLocal(root));
  console.log(`StarForge score: ${report.score}/100 (${report.grade})`);
  setOutput("score", String(report.score));
  setOutput("grade", report.grade);
  if (!isFalse(getInput("card", "true"))) {
    writeFileSync(join2(root, "starforge-card.svg"), renderCard(report, { theme: "light" }));
    writeFileSync(join2(root, "starforge-card-dark.svg"), renderCard(report, { theme: "dark" }));
  }
  const token = getInput("token") || process.env.GITHUB_TOKEN || "";
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!isFalse(getInput("comment", "true")) && token && eventPath) {
    try {
      const event = JSON.parse(readFileSync2(eventPath, "utf8"));
      const issueNumber = event.pull_request?.number ?? event.issue?.number;
      const repoFull = process.env.GITHUB_REPOSITORY;
      if (issueNumber && repoFull) {
        await upsertComment(token, repoFull, issueNumber, renderComment(report));
        console.log(`Posted StarForge audit to #${issueNumber}.`);
      } else {
        console.log("No pull request in this event; skipping comment.");
      }
    } catch (error) {
      console.log(`::warning::Could not post PR comment: ${error.message}`);
    }
  }
  const failUnder = Number.parseInt(getInput("fail-under", "0"), 10) || 0;
  if (failUnder > 0 && report.score < failUnder) {
    console.log(`::error::StarForge score ${report.score} is below the required minimum of ${failUnder}.`);
    process.exitCode = 1;
  }
}
run().catch((error) => {
  console.log(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
