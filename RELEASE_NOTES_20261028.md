# OAU eVoting Production Handover 20261028

## Package purpose

This package is the source-code handover for ICT staging and production deployment of the OAU eVoting system.

## Included

- Next.js and TypeScript application source
- PostgreSQL migrations
- Locked dependency manifest (`pnpm-lock.yaml`)
- Deployment guide and webmaster handover
- Project proposal for INTECU
- Production environment template (`.env.example`)

## Intentionally excluded

- `.env.local` and all production secrets
- PostgreSQL databases and backups
- `node_modules` and `.next` build output
- Voter CSV imports, temporary passwords, and local reports

## ICT deployment order

1. Create the server, PostgreSQL database, HTTPS domain, SMTP relay, backups, and protected environment variables.
2. Copy `.env.example` to a protected `.env.local` file on the server and set all production values.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm db:migrate`.
5. Create the initial administrator using `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD`, then run `pnpm admin:create`; remove these environment variables immediately afterwards.
6. Run `pnpm test` and `pnpm build` on the ICT staging server.
7. Complete the mock-election, backup/restore, SMTP, security, and load checks in `DEPLOYMENT.md` before a real election.
8. Configure the protected automatic-closure cron job described in `DEPLOYMENT.md`.

## Release validation note

The application compilation stage completed successfully on 28 October 2026. The local Codex Windows environment prevented test/build worker processes from starting (`spawn EPERM`), so ICT must complete `pnpm test` and `pnpm build` on the Ubuntu staging server before production approval.

## Security note

Do not place administrator passwords, SMTP passwords, database URLs, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, or `MAINTENANCE_SECRET` inside this package, email, source control, or a shared drive. Transfer them separately through an approved secure channel.
