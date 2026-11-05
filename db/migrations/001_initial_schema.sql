CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('ICT_ADMIN', 'ELECTION_ADMIN', 'APPROVING_OFFICER', 'AUDITOR');
CREATE TYPE election_status AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'APPROVED', 'ARCHIVED');
CREATE TYPE voter_status AS ENUM ('PENDING', 'INVITED', 'ACTIVE', 'VOTED', 'LOCKED', 'ANONYMISED');

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE CHECK (email = lower(email)),
  full_name text NOT NULL, role user_role NOT NULL, password_hash text NOT NULL,
  mfa_enabled boolean NOT NULL DEFAULT false, mfa_secret_encrypted text, mfa_recovery_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE elections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description text, category text NOT NULL, scope text NOT NULL, dashboard_access text NOT NULL DEFAULT 'PUBLIC' CHECK (dashboard_access IN ('PUBLIC', 'UNIVERSITY_ONLY')),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  status election_status NOT NULL DEFAULT 'DRAFT', created_by uuid NOT NULL REFERENCES admin_users(id),
  approved_by uuid REFERENCES admin_users(id), approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'APPROVED') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE election_administrators (
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  PRIMARY KEY (election_id, admin_user_id)
);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), election_id uuid NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
  title text NOT NULL, display_order integer NOT NULL CHECK (display_order >= 0), is_mandatory boolean NOT NULL DEFAULT true,
  UNIQUE (election_id, title), UNIQUE (election_id, display_order)
);

CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), position_id uuid NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  full_name text NOT NULL, department text, manifesto_url text, photo_url text,
  display_order integer NOT NULL CHECK (display_order >= 0), is_active boolean NOT NULL DEFAULT true,
  UNIQUE (position_id, display_order)
);

CREATE TABLE voter_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), election_id uuid NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL REFERENCES admin_users(id), original_filename text NOT NULL, file_checksum text NOT NULL,
  total_rows integer NOT NULL CHECK (total_rows >= 0), valid_rows integer NOT NULL CHECK (valid_rows >= 0), rejected_rows integer NOT NULL CHECK (rejected_rows >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Identity and eligibility are intentionally isolated from anonymous ballot tables.
CREATE TABLE eligible_voters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), election_id uuid NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
  import_batch_id uuid REFERENCES voter_import_batches(id) ON DELETE RESTRICT, full_name text NOT NULL, department text NOT NULL,
  email text NOT NULL CHECK (email = lower(email)), matric_number text, faculty text, password_hash text,
  voter_status voter_status NOT NULL DEFAULT 'PENDING', has_voted boolean NOT NULL DEFAULT false, must_change_password boolean NOT NULL DEFAULT true,
  credential_expires_at timestamptz, last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (election_id, email)
);

CREATE TABLE credential_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), eligible_voter_id uuid NOT NULL REFERENCES eligible_voters(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('INVITATION', 'RESET')), token_hash text, sent_at timestamptz, expires_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'QUEUED', created_at timestamptz NOT NULL DEFAULT now()
);

-- Ballots deliberately contain no voter ID, email, or other identity value.
CREATE TABLE ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), election_id uuid NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
  receipt_reference text NOT NULL UNIQUE, submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ballot_selections (
  ballot_id uuid NOT NULL REFERENCES ballots(id) ON DELETE RESTRICT, position_id uuid NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT, PRIMARY KEY (ballot_id, position_id), UNIQUE (ballot_id, candidate_id)
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), election_id uuid NOT NULL UNIQUE REFERENCES elections(id) ON DELETE RESTRICT,
  storage_key text NOT NULL, content_hash text NOT NULL, report_data jsonb NOT NULL, generated_at timestamptz NOT NULL DEFAULT now(), generated_by uuid NOT NULL REFERENCES admin_users(id)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT now(), actor_admin_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  actor_type text NOT NULL CHECK (actor_type IN ('ADMIN', 'VOTER', 'SYSTEM')), action text NOT NULL, election_id uuid REFERENCES elections(id) ON DELETE RESTRICT,
  target_type text, target_id text, success boolean NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX elections_status_time_idx ON elections(status, starts_at, ends_at);
CREATE INDEX eligible_voters_election_status_idx ON eligible_voters(election_id, voter_status);
CREATE INDEX ballots_election_idx ON ballots(election_id);
CREATE INDEX ballot_selections_position_candidate_idx ON ballot_selections(position_id, candidate_id);
CREATE INDEX audit_events_election_time_idx ON audit_events(election_id, occurred_at DESC);
