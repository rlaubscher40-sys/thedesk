# Security scan follow-up

The main-branch scan on 8ae8e22 reported six findings: two password-hash warnings in `sdk.ts`, one redirect warning in `canonicalHost.ts`, and three format-string warnings in SEO/Instagram logging.

## Changes

- Password verification now awaits PBKDF2-SHA256 (600,000 iterations, 32-byte output, a fresh 32-byte random salt per comparison) on both inputs before a constant-time comparison. The old SHA256 values were transient values for comparison, not database password hashes. This change does not claim that a stored-password breach was found.
- Verification accepts up to 4,096 UTF-8 bytes and runs at most two comparisons at once per process, in addition to the existing per-IP login limit. Excess concurrent work or a derivation failure returns HTTP 503 without issuing a session. Both derivations settle before capacity is released. Password rotation during a comparison invalidates its result.
- Session key derivation, cookies, revocation, TOTP and configured credentials are unchanged. Correct/wrong-password HTTP behavior is covered by the existing database-backed login integration test in CI; unit tests cover Unicode, input bounds, rotation and concurrent-work recovery.
- Canonical redirects reject network-path references, backslashes, whitespace/control characters and non-origin-form request paths. The final destination must resolve to the trusted configured origin before a redirect is sent. Ordinary staging slash corrections remain relative. No request Host value becomes a redirect destination.
- Logging uses constant format strings with request values passed as separate arguments.

These are targeted repairs, not a comprehensive security certification. The security workflow is unchanged; the full main-branch scan remains the verification for all six findings, because PR scans can show only changed findings.

References: [Node.js crypto](https://nodejs.org/api/crypto.html), [CodeQL redirect validation](https://codeql.github.com/codeql-query-help/javascript/js-server-side-unvalidated-url-redirection/).
