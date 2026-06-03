# StarForge launch copy

Replace `<demo-url>` with your Vercel URL and uncomment the npm line once published.

---

## Hacker News (Show HN)

**Title**

```
Show HN: StarForge – audit your repo's launch readiness, get an embeddable card
```

**Body**

```
Good projects often stay quiet because the first five minutes feel unfinished — no
clear one-liner, no quickstart, no demo, no license. StarForge scores the signals a
stranger actually scans before they star, clone, or open a PR.

It doesn't grep for keywords. It checks real files (LICENSE, CI workflows, tests,
CONTRIBUTING), git activity, and package manifests across JavaScript, Python, Rust,
and Go, then groups 13 signals into four categories and tells you the highest-leverage
fixes.

Three ways to use it:
- CLI: `npx starforge owner/name` audits any public repo without cloning.
- An embeddable SVG score card + badge for your README (re-audits itself when hosted).
- A GitHub Action that comments the score on PRs and can gate merges.

There's also an optional AI "launch kit" (bring your own key) that drafts a tagline,
topics, README fixes, and a launch post.

It's MIT, no signup. Repo: https://github.com/Wang-Yeah623/starforge
Live demo: <demo-url>

Feedback on the scoring rules especially welcome — what signal is missing?
```

---

## Reddit (r/opensource, r/programming, r/coolgithubprojects)

**Title**

```
I built StarForge: it audits whether your repo is ready for strangers (real files, not keywords) and gives you an embeddable score card
```

**Body**

```
I kept shipping small projects that went nowhere, and realized the problem was the
first impression, not the code. So I built StarForge.

It scores 13 launch-readiness signals across four categories — first impression,
runnability, trust, and growth — by inspecting actual files (LICENSE, CI, tests,
CONTRIBUTING), git recency, and the package manifest (JS/Python/Rust/Go). No keyword
guessing.

- Try any repo with no install: `npx starforge owner/name`
- Embed a live SVG score card / badge in your README
- A GitHub Action comments the audit on pull requests
- Optional BYOK AI generates a tagline, topics, README fixes, and a launch post

MIT licensed. Repo + live demo in the comments. I'd love feedback on the scoring rules.
```

---

## X / Twitter

```
Most repos don't fail on code — they fail in the first five minutes.

StarForge audits your repo's launch readiness from REAL signals (license, CI, tests,
manifest, git activity) and gives you an embeddable score card.

npx starforge owner/name

MIT, no signup 👇
<demo-url>
```

**Follow-up thread idea:** post the score cards of 3–4 well-known repos to show the
audit on real projects, then link back to the tool.

---

## Notes

- Dogfood first: deploy, then replace the static card in the README with the live
  `/api/card` endpoint so it never goes stale.
- Generate a tailored post for your repo: `starforge . --launch-kit`.
