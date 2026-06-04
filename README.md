# StarForge

> Audit, polish, and launch GitHub projects with a practical star-readiness score.

![CI](https://img.shields.io/badge/CI-passing-2f7a49)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-0.1.0-d6a844)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933)

StarForge is a small CLI and web report that scores whether a repo is easy for strangers to **understand, run, trust, and share**. It scans your README, `package.json`, license, CI config, and contributor files, then turns the gaps into a concrete checklist, ready-to-paste badges, and a launch post draft.

![StarForge preview](./docs/preview.svg)

## What You Get In 5 Seconds

- A 0-100 **star-readiness score** with a clear grade
- The exact signals you are missing, ranked by impact
- A markdown checklist written straight into your repo
- Copy-pasteable **shields.io badges**
- A short **launch post** tailored to your score

## Quickstart

```bash
npm install
npm run starforge -- --path . --checklist
npm test
```

For badges and a launch post:

```bash
npm run starforge -- --path . --badges --launch
```

For structured output:

```bash
npm run starforge -- --path . --json
```

## Why This Exists

Many good projects stay quiet because the first five minutes feel unfinished. StarForge focuses on the signals people scan before they star, clone, share, or open a pull request:

- Clear positioning in the first sentence
- Copy-pasteable install and usage commands
- Screenshot, GIF, demo, or terminal preview
- License, metadata, and test commands
- Contribution path and visible roadmap
- Launch copy that makes sharing easy

## CLI

```bash
starforge [--path ./repo] [--json] [--checklist] [--badges] [--launch]
```

Options:

| Flag | Description |
| --- | --- |
| `--path`, `-p` | Repository path to audit |
| `--json` | Print a structured audit report |
| `--checklist` | Write `STARFORGE_CHECKLIST.md` into the audited repo |
| `--badges` | Print copy-pasteable shields.io badges |
| `--launch` | Print a shareable launch post draft |
| `--help`, `-h` | Show usage help |

StarForge does not just read your README. It also inspects the repo for a
`LICENSE`, `CONTRIBUTING`, `CHANGELOG`, CI workflows under `.github/workflows`,
and issue/PR templates, so the score reflects the whole first impression.

## Web Report

Run the local report UI:

```bash
npm run dev
```

Then open the Vite URL printed in your terminal. The UI has two modes:
- Paste a GitHub URL (like `https://github.com/facebook/react` or `owner/repo`) to audit a public repo
- Use the live editor to paste your README and watch the score, signals, and launch post update instantly

## Example Output

```text
StarForge score: 88/100 (Launch-ready)
Strong launch shape. Only 1 signal needs attention before sharing widely.

Fix next:
- Add a short, concrete promise under the H1: who it helps and what it does.

Badges:
![CI](https://img.shields.io/badge/CI-passing-2f7a49)
![License](https://img.shields.io/badge/license-MIT-blue)

Launch post:
I built starforge: Audit, polish, and launch GitHub projects with a practical star-readiness score.
...
```

## Launch Template

Use this when you publish the repo:

```text
I built StarForge, a tiny CLI that audits whether a GitHub repo is ready for strangers.

It checks README clarity, quickstart quality, demo presence, metadata, license, test scripts, contributor path, launch copy, and roadmap, then writes a checklist.

Try it:
npm run starforge -- --path . --checklist
```

## Development

```bash
npm install
npm run lint
npm test
npm run build
```

## Roadmap

- [x] Badge suggestions for CI, license, and version
- [x] Generate a social launch post from the score
- [x] Scan license, CI, contributing, and template files (not just the README)
- [x] Audit remote repos directly from a GitHub URL
- [ ] Generate release notes from commit history
- [ ] Support Python and Rust package metadata
- [ ] GitHub Action annotations for pull requests

## Contributing

Contributions are welcome. Good first issues include new audit rules, clearer copy, CLI ergonomics, and report UI improvements.

Please run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.

## License

MIT
