-- Audit events may retain the voter email for accountability, but must never
-- contain a receipt reference or ballot fingerprint that could link identity
-- records to an anonymous ballot.
UPDATE audit_events
SET metadata = metadata - 'receipt' - 'auditHash' - 'receiptReference' - 'fingerprint'
WHERE metadata ?| ARRAY['receipt', 'auditHash', 'receiptReference', 'fingerprint'];