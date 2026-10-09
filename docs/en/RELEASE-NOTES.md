# OpenTask 0.1.0-alpha

[简体中文](../zh-CN/RELEASE-NOTES.md)

First alpha candidate for developers to install and try a local, single-team task workspace. Distribution is source code; the intended tag is `v0.1.0-alpha`, marked as a prerelease.

## Included

- Creation approval, explicit owner acceptance, execution and reviewer acceptance.
- Approved checklists, formal progress, blocker collaboration and version confirmation after agreement changes.
- Return and resubmission in the same task, preserving earlier results and reasons.
- Parent/child, prerequisite and related tasks; task tree, graph, team activity and role-specific followups.
- Planned dates and personal time filters with global and project settings.
- English and Simplified Chinese UI and offline documentation, light/dark themes and the OpenTask cat branding.
- PostgreSQL persistence, recoverable background jobs, migrations, backup and isolated restore checks.

## Install and upgrade

Use Node.js 24, npm, Docker Engine and Compose. Follow [local setup](QUICKSTART.md); run both API and worker. Source installation uses `npm ci`, migrations and a production build. `private: true` is retained; this release is not an npm package.

For existing workspaces, stop writes and the worker, back up and verify an isolated restore before migration. Keep the old code version. See [release checks](RELEASE-CHECK.md). Restore comparisons include nonempty time preferences, sessions, idempotency records and worker health, as well as business tables and queued jobs.

## Scope and known limits

The API and database listen only on localhost. Sessions target local HTTP. Public HTTPS, reverse proxies, remote team access and production departmental use require separate work and verification.

Non-draft tasks are team-visible. There is no directory login, upload storage, outbound messaging, model or Agent integration. Evidence links preserve URLs, not remote files. Human usability acceptance and sustained real-team trials remain open; this alpha provides the version to try.

Seed accounts and their documented password are synthetic local test identities. Do not expose this setup to a public network. Backups and session material are private operational data and are not release attachments.

## License

OpenTask is licensed under [Apache-2.0](../../LICENSE). Existing icon licenses remain in their original form; see [third-party notices](THIRD-PARTY-NOTICES.md).

## Verification

Use [release checks](RELEASE-CHECK.md) to reproduce the checks. The [candidate readiness report](RELEASE-READINESS.md) records current evidence; the earlier [case report](RELEASE-CASE-RESULT.md) preserves historical UI and API verification.
