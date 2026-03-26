# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email **[security@group-ironmen.com]** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You can expect an initial response within **72 hours**. We will work with you to understand and address the issue before any public disclosure.

## Security Measures

This project employs the following security practices:

- **CodeQL** static analysis on every push and weekly schedules
- **Dependabot** automated dependency updates for npm, Cargo, Docker, and GitHub Actions
- **npm audit** and **cargo audit** run in CI to catch known vulnerabilities
- **Trivy** container image scanning for critical and high severity CVEs
- **Non-root Docker containers** for both frontend and backend services
- **Multi-stage Docker builds** to minimize attack surface
- **hCaptcha** integration for abuse prevention
- **BLAKE2 token hashing** for group authentication
- Pre-commit hooks with **ESLint** and **Prettier** for code quality

## Disclosure Policy

We follow coordinated disclosure. Once a fix is available, we will:

1. Release a patched version
2. Publish a security advisory (if applicable)
3. Credit the reporter (unless anonymity is requested)
