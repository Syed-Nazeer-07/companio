# Security policy

## Release status

Companio is an active Windows preview, not a signed production release. The current preview is identified in the [README](README.md). Older versions are historical and are not independently maintained.

## Reporting vulnerabilities

Please avoid opening a public issue containing exploit details, secrets or private user information. Use GitHub private vulnerability reporting if enabled; otherwise contact the [maintainer](https://github.com/Syed-Nazeer-07) privately through an available contact channel. Include the affected version, Windows architecture, reproduction steps, expected impact and sanitized evidence. Do not include real API keys or personal history.

No response-time or remediation guarantee is implied.

## Trust and privacy

- Verify official installer checksums from the corresponding release notes; unsigned previews may trigger publisher warnings. Never disable Windows security protections.
- Local history is not encrypted. Treat exported history and logs as private.
- Native actions are limited to supported tools and validation/approval controls; the application is not an unrestricted autonomous agent.
- Report suspected unsafe action execution, unexpected microphone capture, insecure local AI access or compromised release artifacts promptly.

See the [user guide](docs/user-guide.md#privacy-security-and-limitations) for current limitations.
