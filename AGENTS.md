# AGENTS.md

## Repository Overview

**Name:** actions  
**Type:** GitHub Actions  
**Description:** Collection of reusable GitHub Actions for CI/CD, version management, testing, security, and localization workflows

## Tech Stack

- **Languages:** TypeScript, JavaScript, Python, Bash
- **Runtime:** Node.js (16, 20, 24)
- **Monorepo:** Lerna
- **Testing:** Jest, Playwright
- **Integrations:** Sentry, Lokalise, Semgrep, DefectDojo

## Architecture

### Project Structure

```
actions/
├── bump-version/              # Version bumping action
├── bump-packages/             # Package bumping
├── get-deployment-stages/     # Deployment stage retrieval
├── get-e2e-stages/            # E2E stage retrieval
├── playwright-to-sentry/      # Playwright errors to Sentry
├── jest-to-sentry/            # Jest errors to Sentry
├── jest-coverage/             # Coverage reporting
├── lint-lokalise/             # i18next XML validator
├── lokalise-download/         # Lokalise translation download
├── dependabot-combine/        # Combine SDK updates
├── for-each-repo/             # Iterate org repositories
├── import-semgrep-report/     # Semgrep to DefectDojo
├── dependency-track-check/    # Dependency security
├── check-iam-wildcards/       # IAM wildcard validation
├── check-last-version/        # Version checking
├── e2e-websome/               # Websome E2E testing
├── update-spec/               # Spec update automation
├── sentry-issue-limiter/      # Sentry rate limiting
├── fail-on-code-and-migrations/ # PR validation
├── cancel-when-already-running/ # Duplicate cancellation
├── changelog/                 # Changelog generation
├── lerna.json                 # Monorepo config
└── package.json
```

### Key Actions

| Action                        | Description                            |
| ----------------------------- | -------------------------------------- |
| `bump-version`                | Bump version, commit, create tag, push |
| `playwright-to-sentry`        | Send Playwright errors to Sentry       |
| `jest-to-sentry`              | Send Jest errors to Sentry             |
| `lint-lokalise`               | Validate i18next XML translations      |
| `lokalise-download`           | Download Lokalise translations         |
| `dependabot-combine`          | Combine SDK dependency updates         |
| `import-semgrep-report`       | Import Semgrep to DefectDojo           |
| `check-iam-wildcards`         | Validate IAM wildcard resources        |
| `fail-on-code-and-migrations` | Prevent mixed PRs                      |

## Development

### Commands

```bash
# Install dependencies
npm ci
lerna bootstrap

# Run tests
lerna run test

# Build all actions
lerna run build
```

### Creating a New Action

1. Create directory: `mkdir my-action`
2. Add `action.yml` with inputs/outputs
3. Add `index.ts` or `index.js`
4. Update `lerna.json` if needed
5. Add tests

### Key Files

- `*/action.yml` - Action definitions
- `*/index.ts` - Action implementations
- `lerna.json` - Monorepo configuration

## Testing

Each action has its own test suite using Jest.

## Notes for AI Assistants

- **Lerna monorepo** - actions are independent packages
- Each action has its own **action.yml** definition
- Test actions locally before publishing
- Follow existing action patterns
- Update **action.yml** for input/output changes
- Consider backwards compatibility
- Actions run in GitHub's hosted runners
