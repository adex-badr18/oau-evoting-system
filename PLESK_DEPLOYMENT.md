# Plesk Production Deployment

This ZIP contains application source only. It deliberately excludes `.env.local`, all `.env*` credential files (except the safe `.env.example` template), `node_modules`, `.next`, `.pnpm-store`, `outputs`, `work`, local databases, generated ZIPs, and administrator passwords.

## Server prerequisites

- Node.js 21 and pnpm 11 enabled in Plesk.
- A PostgreSQL database and database user.
- A domain with HTTPS enabled.
- University SMTP relay credentials.

## Deploy

1. In Plesk, create a Node.js application for the domain and set its application root to this extracted folder.
2. Upload this ZIP, then extract it into the application root. Do not extract it into `httpdocs` if Plesk has assigned another Node.js application root.
3. Create a server-only `.env.local` file from `.env.example`, or enter the same values through Plesk's protected Node.js environment settings. Enter real production values for every secret. Do not upload an existing local `.env.local` file.
4. In the Plesk terminal, run:

   ```bash
   corepack enable
   corepack prepare pnpm@11.20.0 --activate
   pnpm install --frozen-lockfile
   pnpm db:migrate
   pnpm build
   ```

5. Configure the Node.js application start command as `pnpm start`, restart it, then verify the public page, administrator sign-in, email delivery, and a test election.

## Administrator account

Your existing administrator account is retained only when the existing production PostgreSQL database is retained. Run `pnpm db:migrate`; do not rerun the setup page and do not set `ADMIN_RESET=true`.

For a brand-new database, define `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` only in Plesk's protected environment settings, run `pnpm db:migrate`, then run `pnpm admin:create` once. Remove `ADMIN_PASSWORD` from the environment after the account is created and enrol MFA immediately. Never set `ADMIN_RESET=true` in production.

## Required scheduled task

Configure Plesk Scheduled Tasks to call the election-maintenance endpoint once per minute, using the `MAINTENANCE_SECRET` documented in `DEPLOYMENT.md`.
### First administrator setup (new database)

1. In Plesk's protected environment settings, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` for the first ICT administrator. Use a unique, strong password.
2. In the Plesk terminal, run `pnpm db:migrate`, then `pnpm admin:create` exactly once.
3. Remove `ADMIN_PASSWORD` from Plesk's environment settings and restart the application.
4. Visit `/admin/login`, sign in with the new account, and enrol MFA before inviting voters or creating an election.
