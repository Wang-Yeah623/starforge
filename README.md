# StarForge

Audit, polish, and launch GitHub projects with a practical star-readiness score.

StarForge is a small CLI and web report that checks whether a repo is easy for strangers to understand, run, trust, and share. It turns README gaps, missing metadata, weak launch assets, and contributor friction into a concrete checklist.

![StarForge preview](./docs/preview.svg)

## Quickstart

```bash
npm install
npm run starforge -- --path . --checklist
npm test
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
starforge [--path ./repo] [--json] [--checklist]
```

Options:

| Flag | Description |
| --- | --- |
| `--path`, `-p` | Repository path to audit |
| `--json` | Print a structured audit report |
| `--checklist` | Write `STARFORGE_CHECKLIST.md` into the audited repo |
| `--help`, `-h` | Show usage help |

## Web Report

Run the local report UI:

```bash
npm run dev
```

Then open the Vite URL printed in your terminal. The UI shows a sample audit, scoring rules, and launch checklist patterns.

## Example Output

```text
StarForge score: 94/100 (Launch-ready)
Strong launch shape. Only 1 signal needs attention before sharing widely.

Fix next:
- Add a tiny roadmap with near-term improvements people can imagine joining.
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

- Add badge suggestions for CI, license, npm, and docs
- Generate release notes and social launch posts
- Support Python and Rust package metadata
- Add GitHub Action annotations for pull requests

## Contributing

Contributions are welcome. Good first issues include new audit rules, clearer copy, CLI ergonomics, and report UI improvements.

Please run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.

## License

MIT
