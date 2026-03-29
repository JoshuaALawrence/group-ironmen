# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email **[joshua@lawrence.zip]** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You can expect an initial response within **72 hours**. We will work with you to understand and address the issue before any public disclosure.

## Security Measures

This project employs the following security practices:

- **CodeQL** analysis for both application code and GitHub workflow code on every protected-branch change and on a weekly schedule
- **Gitleaks** secret scanning on every push and pull request, plus a weekly full-history sweep
- **Dependency Review** on every pull request to block newly introduced vulnerable packages
- **npm audit** run in CI to catch known vulnerable dependencies
- **Trivy** container scanning to block critical and high severity image CVEs before release
- **CODEOWNERS** enforced review ownership for backend, frontend, infrastructure, and utility paths
- **Dependabot** automated dependency updates for npm, Docker, and GitHub Actions
- **Non-root Docker containers** for both frontend and backend services
- **Multi-stage Docker builds** to minimize attack surface
- **hCaptcha** integration for abuse prevention
- **BLAKE2 token hashing** for group authentication

## Required GitHub Repository Settings

Some of the highest-value protections live in GitHub repository settings rather than in versioned files. For maximum safety, enable the following on the default branch ruleset:

1. Require pull requests before merge.
2. Require at least 1 approval from a code owner.
3. Dismiss stale approvals when new commits are pushed.
4. Require all review conversations to be resolved.
5. Require signed commits.
6. Require linear history.
7. Block force pushes and branch deletions.
8. Restrict bypass permissions to the smallest possible admin set.
9. Enable merge queue if you use batch merges.
10. Enable GitHub secret scanning, push protection, Dependabot alerts, and private vulnerability reporting.

Recommended required status checks:

1. `CI / Verify App`
2. `CI / Dependency Audit`
3. `CI / Verify Docker Image`
4. `Secret Scanning / Gitleaks – Detect Secrets`
5. `CodeQL / Analyze (actions)`
6. `CodeQL / Analyze (javascript-typescript)`
7. `Dependency Review / dependency-review`

## Disclosure Policy

We follow coordinated disclosure. Once a fix is available, we will:

1. Release a patched version
2. Publish a security advisory (if applicable)
3. Credit the reporter (unless anonymity is requested)
