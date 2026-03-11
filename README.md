# auto-agents

Automated AI-powered PR reviews using [pi](https://github.com/mariozechner/pi-coding-agent) and Claude. Set up once, reuse across all your repos.

## Setup

### 1. Authentication (pick one)

#### Option A: Claude subscription (OAuth)

Use your existing Claude Pro/Team subscription — no API costs.

1. Make sure you're logged into pi locally with your Claude account (`pi` → login when prompted)
2. Extract your OAuth credentials:
   ```bash
   cat ~/.pi/agent/auth.json | jq '.anthropic'
   ```
   You'll see something like:
   ```json
   {
     "type": "oauth",
     "refresh": "re_...",
     "access": "ant-oa_...",
     "expires": 1234567890
   }
   ```
3. Copy the **entire JSON object** (including `type`, `refresh`, `access`, `expires`)
4. Add it as a GitHub secret named `ANTHROPIC_OAUTH`:
   - **Org-level**: GitHub → Your org → Settings → Secrets → Actions → New
   - **Per-repo**: Repo → Settings → Secrets → Actions → New

> ⚠️ OAuth refresh tokens can expire. If reviews stop working, re-run step 2-4 with fresh credentials.

#### Option B: API key

1. Get a key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Add it as a GitHub secret named `ANTHROPIC_API_KEY`

### 2. Add to any repo

Create `.github/workflows/pr-review.yml` in the target repo:

**With OAuth (Claude subscription):**
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
      ANTHROPIC_OAUTH: ${{ secrets.ANTHROPIC_OAUTH }}
```

**With API key:**
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

All inputs are optional — defaults work out of the box.

```yaml
jobs:
  review:
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    with:
      model: claude-opus-4-20250514    # default: claude-sonnet-4-20250514
      thinking_level: high              # default: medium
    secrets:
      ANTHROPIC_OAUTH: ${{ secrets.ANTHROPIC_OAUTH }}
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
      ANTHROPIC_OAUTH: ${{ secrets.ANTHROPIC_OAUTH }}

  review-develop:
    if: github.base_ref == 'develop'
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    with:
      model: claude-sonnet-4-20250514
      thinking_level: medium
    secrets:
      ANTHROPIC_OAUTH: ${{ secrets.ANTHROPIC_OAUTH }}
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
auto-agents/
├── .github/workflows/
│   └── pi-pr-review.yml    # reusable workflow (called by other repos)
├── scripts/
│   └── pr-review.ts         # review script using pi SDK
├── skills/
│   └── pr-review/
│       └── SKILL.md          # pr-review skill instructions
└── README.md
```
