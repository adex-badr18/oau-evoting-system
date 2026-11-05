-- Voter identity is retained only in the restricted audit trail, never in ballots.
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS voter_email text;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_voter_email_lowercase
  CHECK (voter_email IS NULL OR voter_email = lower(voter_email));

CREATE INDEX IF NOT EXISTS audit_events_voter_email_idx
  ON audit_events (election_id, voter_email, occurred_at DESC)
  WHERE voter_email IS NOT NULL;