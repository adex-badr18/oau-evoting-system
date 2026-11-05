-- A privacy-preserving fingerprint for each anonymous ballot. It contains no voter ID or candidate selection.
ALTER TABLE ballots ADD COLUMN IF NOT EXISTS audit_hash text;
UPDATE ballots
SET audit_hash = encode(digest(election_id::text || ':' || receipt_reference, 'sha256'), 'hex')
WHERE audit_hash IS NULL;
ALTER TABLE ballots ALTER COLUMN audit_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ballots_audit_hash_idx ON ballots(audit_hash);