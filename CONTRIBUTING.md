# Contributing to Companio

Thank you for helping improve Companio. The project is in active preview.

## Local setup

Use Windows 11, Node.js 22 and Git. Run `npm ci`, `npm run build` and `npm start` from the repository root. See the [development guide](docs/development.md) for architecture and additional commands.

## Changes

- Keep changes focused; explain the problem, implementation and any trade-offs.
- Preserve existing user preferences and desktop safety checks.
- Add regression tests for bugs and new supported actions.
- Do not commit generated installers, dependencies, local model weights, credentials, user histories or private logs.
- Run `npm run test:unit` and `npm run build`. For desktop changes, test the packaged app on Windows and state the architecture and display scaling tested.
- Interactive native tool tests can affect Windows state; run them only in a suitable test environment.
- For UI changes, include screenshots; for installer or AI changes, include real setup and inference results, not only mocked output.
- Open a focused pull request and disclose failures or unverified scenarios. Avoid merging incomplete release work.

For ordinary bugs, use [GitHub Issues](https://github.com/Syed-Nazeer-07/companio/issues). For security concerns, see [SECURITY.md](SECURITY.md).
