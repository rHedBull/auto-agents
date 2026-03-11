# pi-pr-review

Automated AI-powered PR reviews using [pi](https://github.com/mariozechner/pi-coding-agent) and Claude. Set up once, reuse across all your repos.

## Setup

### 1. Push this repo

Push this repo to GitHub (e.g. `rHedBull/auto-agents`).

Then update the `WORKFLOW_REPO` value in `.github/workflows/pi-pr-review.yml`:

```yaml
WORKFLOW_REPO: rHedBull/auto-agents  # ← your actual org/repo
```

### 2. Set the API key

Set `ANTHROPIC_API_KEY` as an **organization-level secret** (Settings → Secrets → Actions) so all repos can use it. Or set it per-repo.

### 3. Add to any repo

Create `.github/workflows/pr-review.yml` in the target repo:

```yaml
name: PR Review
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]

jobs:
  review:
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

That's it. Every PR to `main` gets an AI review posted as a comment.

## Configuration

All options are optional — defaults work out of the box.

```yaml
jobs:
  review:
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    with:
      model: claude-opus-4-20250514    # default: claude-sonnet-4-20250514
      thinking_level: high              # default: medium
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

| Input | Default | Description |
|-------|---------|-------------|
| `model` | `claude-sonnet-4-20250514` | Claude model to use |
| `thinking_level` | `medium` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh` |

### Multiple branches

```yaml
on:
  pull_request:
    branches: [main, develop, release/*]
    types: [opened, synchronize, reopened]
```

### Different settings per branch

```yaml
jobs:
  review-main:
    if: github.base_ref == 'main'
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    with:
      model: claude-opus-4-20250514
      thinking_level: high
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

  review-develop:
    if: github.base_ref == 'develop'
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    with:
      model: claude-sonnet-4-20250514
      thinking_level: medium
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## What the review checks

The review runs 5 parallel analysis passes:

1. **Convention Compliance** — checks against project rules (CLAUDE.md, CONVENTIONS.md, etc.)
2. **Bug Scan** — logic errors, null handling, off-by-one, missing error handling
3. **Historical Context** — git blame/log to catch contradictions with recent fixes
4. **Related PR Context** — recent merged PRs touching the same files
5. **Code Comment Compliance** — violations of guidance in TODO, NOTE, doc comments

Only issues with **confidence ≥ 80** are reported. Lower-confidence findings are filtered out to reduce noise.

## Customizing the skill

Fork this repo and edit `skills/pr-review/SKILL.md` to:

- Adjust the confidence threshold
- Add/remove review agents
- Change the output format
- Add project-specific review rules

## Project structure

```
pi-pr-review/
├── .github/workflows/
│   └── pi-pr-review.yml    # reusable workflow (called by other repos)
├── scripts/
│   └── pr-review.ts         # review script using pi SDK
├── skills/
│   └── pr-review/
│       └── SKILL.md          # pr-review skill instructions
└── README.md
```
