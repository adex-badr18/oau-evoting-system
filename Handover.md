# OAU eVoting â€” Webmaster Handover

## Purpose

This package is the OAU eVoting application source code for ICT deployment. It supports election configuration, voter CSV import, password invitations, voting, a live results dashboard, approval, and an approved-results repository.

## What must not be transferred

Do **not** transfer `.env.local`, local PostgreSQL data, temporary voter passwords, or `node_modules`. The source package contains `.env.example` only.

## Hosting requirements

- A University-owned HTTPS domain, for example `https://evoting.oauife.edu.ng`.
- Node.js 21 and pnpm 11.
- PostgreSQL 16 or later, managed by ICT with encrypted backups.
- A University SMTP relay account.
- A reverse proxy/load balancer that terminates TLS and forwards requests to the application.
- Monitoring, log retention, database backups, and an incident contact.

## Production environment configuration

Create protected server environment variables from `.env.example`. Never commit their values to Git or place them in browser code.

Required: `DATABASE_URL`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SUPPORT_EMAIL`, and `APP_URL`.

- `APP_URL` must be the final HTTPS public address without a trailing slash.
- `AUTH_SECRET` must be a unique, randomly generated value of at least 32 characters.
- `MFA_ENCRYPTION_KEY` must be a base64-encoded random 32-byte key.
- Use a restricted database account that only the application service can use.

## Deployment commands

Run these on the staging server first, from the application folder:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm test
pnpm build
pnpm start
```

The initial admin is created with the environment variables `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD`, then:

```bash
pnpm admin:create
```

Remove these temporary environment variables immediately after use. The first administrator should sign in, change the password, and have ICT enrol MFA before public use.

## Mandatory staging checks

1. Run a mock election with non-production test voters only.
2. Verify invitation emails contain the correct HTTPS link with the election ID.
3. Verify each voter can submit only one ballot and cannot vote outside the open period.
4. Verify dashboard figures without exposing voter identities.
5. Close and approve the mock election; verify its report and SHA-256 hash.
6. Restore a database backup into an isolated test server.
7. Load-test at least 150% of the expected concurrent voters.
8. Obtain written ICT/security approval before a real election.

## Operational rules

- Never deploy code, edit candidates, or alter the database while an election is open.
- An election must be closed before an Approving Officer approves its official report.
- Keep raw voter information only for the University-approved retention period; use the admin anonymisation function only after approval and the retention decision.
- The browserâ€™s **Print or save as PDF** command is used to create a printable report copy.

## Important production review

This is an implementation handover, not an independent security certification. ICT must perform its own security review, accessibility review, penetration test, load test, backup/restore test, and election-policy/legal approval before it is used for a live University election.

## Automatic election closure

Set `MAINTENANCE_SECRET` to a separate long random value. Configure a server-side cron job every minute to call:

```bash
curl --fail --silent --show-error -X POST https://evoting.oauife.edu.ng/api/internal/election-maintenance -H "Authorization: Bearer YOUR_MAINTENANCE_SECRET"
```

This job changes expired scheduled elections to `CLOSED` and creates an audit record. Ballot submission independently refuses voting after the configured end time.

## Audit and verification pack

The administrator workspace provides an **Audit & verification** link for closed and approved elections. Access is limited server-side to `ICT_ADMIN`, the assigned `ELECTION_ADMIN`, `APPROVING_OFFICER`, and `AUDITOR` roles. It supplies a printable/downloadable audit record without exposing voter identity or ballot choices. ICT should retain its exported copy and a protected database backup until the University objection period has ended.

## Anonymous ballot fingerprints

Run `pnpm db:migrate` during deployment. Migration 002 adds a protected SHA-256 fingerprint to each anonymous ballot. The fingerprint register is visible only in the restricted Audit & Verification Pack after an election is closed, never on the public dashboard.
