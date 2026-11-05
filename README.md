# University E-Voting System

This repository contains the secure web application used to administer and run university elections.

## Local test administrator

After the database migration, create one local test ICT administrator. Choose a unique password; it is not stored in the source code:

```powershell
$env:ADMIN_EMAIL = "oahammed@oauife.edu.ng"
$env:ADMIN_PASSWORD = "replace-this-with-a-unique-12-character-password"
$env:ADMIN_NAME = "OAU ICT Test Administrator"
pnpm admin:create
```

Then sign in at `/admin/login` using that email and password. This setup command is for development or a controlled test environment; production administrators must use a university-approved process and MFA.

## Local development

1. Copy `.env.example` to `.env.local` and set local secrets.
2. Start PostgreSQL with `docker compose up -d database`.
3. Install packages with `pnpm install`.
4. Apply the database schema with `pnpm db:migrate`.
5. Start the app with `pnpm dev`.

## Security boundary

The web application is the only service that should access the voting database. Administrators manage election configuration but must not receive direct database access. Voter eligibility is stored separately from anonymous ballots; no application query may join an identity to candidate selections.
