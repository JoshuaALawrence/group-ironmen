## Summary

Describe the change and the reason for it.

## Risk Check

- [ ] I reviewed this change for hardcoded secrets, tokens, credentials, and internal-only URLs.
- [ ] I called out any security-sensitive behavior changes.
- [ ] I noted any backward-incompatible changes.

## Validation

- [ ] `npm run test:server`
- [ ] `npm run test:coverage:site`
- [ ] `npm run build`
- [ ] Docker changes were built and reviewed if this PR touches container or deploy files.