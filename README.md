# auto-agents

Automated AI-powered PR reviews using [pi](https://github.com/mariozechner/pi-coding-agent) and Claude. Set up once, reuse across all your repos.

## Quick Start

### 1. Set up authentication (once)

Pick one of the two options:

#### Option A: API key (recommended for CI)

Reliable, doesn't expire, pay-per-use (~$0.05–0.30 per review with Sonnet).

1. Get a key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Add it as a GitHub **repository secret** named `ANTHROPIC_API_KEY` on each repo where you want reviews:
   - Repo → Settings → Secrets and variables → Actions → New repository secret

> **Tip:** If you have a GitHub Organization, set it as an **org-level secret** (Org → Settings → Secrets → Actions) so all repos can use it without per-repo setup.

#### Option B: Claude subscription (OAuth)

Use your existing Claude Pro/Team subscription — no extra API costs.

1. Make sure you're logged into pi locally with your Claude account (`pi` → log in when prompted)
2. Extract your OAuth credentials:
   ```bash
   cat ~/.pi/agent/auth.json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['anthropic'], indent=2))"
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
3. Copy the **entire JSON object**
4. Add it as a GitHub **repository secret** named `ANTHROPIC_OAUTH`

> ⚠️ **Important:** OAuth access tokens are short-lived. Every time you use `pi` locally, it refreshes the token — which invalidates the one stored in GitHub. When reviews start failing with auth errors, re-run steps 2–4 with fresh credentials. For a set-and-forget setup, use Option A instead.

### 2. Add the workflow to your repo

Create `.github/workflows/pr-review.yml` in the repo you want reviewed:

**With API key:**
```yaml
name: PR Review
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    secrets: inherit
```

**With OAuth:**
```yaml
name: PR Review
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    secrets: inherit
```

> **Note:** Both options use `secrets: inherit` — the workflow auto-detects which secret is available (`ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH`).

### 3. Done

Open a PR targeting `main` and the review will be posted automatically as a PR review comment.

## Step-by-step example

Here's a complete walkthrough for adding PR reviews to a repo called `my-app`:

1. **Set the secret** on `my-app`:
   - Go to https://github.com/YOUR_USER/my-app/settings/secrets/actions
   - Click "New repository secret"
   - Name: `ANTHROPIC_API_KEY` (or `ANTHROPIC_OAUTH`)
   - Value: your API key (or OAuth JSON)

2. **Create the workflow file** in your repo:
   ```bash
   mkdir -p .github/workflows
   cat > .github/workflows/pr-review.yml << 'EOF'
   name: PR Review
   on:
     pull_request:
       branches: [main]
       types: [opened, synchronize]

   permissions:
     pull-requests: write
     contents: read

   jobs:
     review:
       uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
       secrets: inherit
   EOF
   ```

3. **Commit and push**:
   ```bash
   git add .github/workflows/pr-review.yml
   git commit -m "Add automated PR review"
   git push
   ```

4. **Open a PR** to `main` — the review appears automatically.

## Configuration

All inputs are optional — defaults work out of the box.

```yaml
jobs:
  review:
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    with:
      model: claude-opus-4-20250514    # default: claude-sonnet-4-20250514
      thinking_level: high              # default: medium
    secrets: inherit
```

| Input | Default | Description |
|-------|---------|-------------|
| `model` | `claude-sonnet-4-20250514` | Claude model to use |
| `thinking_level` | `medium` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh` |

### Review multiple branches

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
    secrets: inherit

  review-develop:
    if: github.base_ref == 'develop'
    uses: rHedBull/auto-agents/.github/workflows/pi-pr-review.yml@main
    with:
      model: claude-sonnet-4-20250514
      thinking_level: medium
    secrets: inherit
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

## Troubleshooting

### "Authentication failed" error
- **OAuth:** Your access token has expired. Re-extract credentials from `~/.pi/agent/auth.json` (use pi locally first to refresh them) and update the GitHub secret.
- **API key:** Check that `ANTHROPIC_API_KEY` is set correctly on the repo.

### Workflow shows "startup_failure"
- Make sure the `permissions` block is present in your calling workflow (both `pull-requests: write` and `contents: read`).

### Review doesn't trigger
- The workflow only triggers on PRs targeting branches listed in `branches:` (default: `main`).
- Check that the trigger types include the event (`opened`, `synchronize`).

## Project structure

```
auto-agents/
├── .github/workflows/
│   └── pi-pr-review.yml       # reusable workflow (called by other repos)
├── skills/
│   └── pr-review/
│       └── SKILL.md            # pr-review skill instructions
└── README.md
```
