# OAU eVoting - ICT Deployment Guide

## Before deployment

1. Assign a University-owned domain, for example `evoting.oauife.edu.ng`.
2. Provide a managed PostgreSQL database with encrypted backups.
3. Create separate Development, Staging, and Production environments.
4. Obtain a University SMTP relay account. Do not use a personal email account.
5. Generate unique production values for `AUTH_SECRET` and `MFA_ENCRYPTION_KEY`.
6. Retain the existing production ICT administrator account, or create the first account once and enrol their authenticator app before public use.
7. Run a mock election using only test voters.

## Required environment settings

`DATABASE_URL`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SUPPORT_EMAIL`, and `APP_URL` must be set only in the protected server environment. Never place them in source code or the browser.

## Administrator account continuity

Administrator credentials are stored only as password hashes in the production database, never in source code or the repository. When deploying from an existing production database, retain that database and run `pnpm db:migrate`; your current administrator account remains available.

For a new production database, create the first ICT administrator once using protected server environment values for `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME`, then enrol MFA. Do not set `ADMIN_RESET=true` in production: the administrator-creation script rejects it so an existing account cannot be overwritten accidentally.
## Deployment procedure

1. Install the locked package versions.
2. Run the database migration using `pnpm db:migrate`.
3. Run `pnpm test` and `pnpm build` in Staging.
4. Run a load test at 150% of the forecast concurrent voter count.
5. Verify the SMTP configuration with test accounts.
6. Test backup restoration and confirm approved-report hashes remain unchanged.
7. Put the application behind HTTPS, a University firewall/WAF, and monitoring.

## Election-day procedure

1. Confirm the scheduled times, candidates, voter total, dashboard, support contact, and backups.
2. Monitor availability, errors, email delivery, and database capacity. Do not inspect voter selections.
3. Do not deploy code or configuration changes while an election is open except through the approved emergency process.
4. After closure, the Approving Officer reviews totals and approves the election.
5. Save/print the official report and perform voter-data anonymisation only after the approved retention decision.

## Minimum acceptance tests

- Valid and invalid CSV uploads are handled correctly.
- Each invitation produces a unique temporary password.
- A voter must change the temporary password before voting.
- One voter cannot submit twice.
- Voting is refused before opening and after closure.
- Dashboard totals update without exposing any voter identity.
- Approval produces a report whose totals equal the closed-election totals.
- Anonymisation removes voter personal data while retaining aggregate reports and audits.

## Automatic election closure

Set a separate random `MAINTENANCE_SECRET` in the protected server environment. ICT must call the protected endpoint once per minute; it closes any scheduled election whose end time has passed and records a system audit event:

```bash
* * * * * curl --fail --silent --show-error -X POST https://evoting.oauife.edu.ng/api/internal/election-maintenance -H "Authorization: Bearer YOUR_MAINTENANCE_SECRET" >/dev/null
```

The endpoint is not for browsers and must never be exposed without its secret. The application also rejects late ballots even if a scheduled job is temporarily unavailable.

## Audit and verification pack

After an election is `CLOSED` or `APPROVED`, an authorised ICT administrator, assigned Election Administrator, Approving Officer, or Auditor can open **Audit & verification** from the administrator workspace. The pack can be printed or downloaded as JSON and includes voter-import checksums and totals, credential-delivery totals, turnout reconciliation, results, report hash, and a restricted audit timeline with voter email addresses, event actions, and timestamps. It never displays temporary passwords, candidate selections, receipt references, or ballot fingerprints alongside an email address.

Do not anonymise voter records until the University objection/appeal period has ended. Keep the confidential database backup and the verification pack under ICT custody for the approved retention period.

## Anonymous ballot fingerprints

Migration `002_ballot_audit_hash.sql` adds a SHA-256 fingerprint to each anonymous ballot. The fingerprint is based only on the election ID and private receipt reference; it contains no voter identity or candidate selection. The restricted Audit & Verification Pack shows the recorded submission time and fingerprint only after closure. Do not expose this register while voting is live.
