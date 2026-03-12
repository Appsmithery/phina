ALTER TABLE member_entitlements
  DROP CONSTRAINT IF EXISTS member_entitlements_source_check;

ALTER TABLE member_entitlements
  ADD CONSTRAINT member_entitlements_source_check
  CHECK (source IN ('apple', 'google', 'stripe', 'admin', 'none'));

ALTER TABLE host_credit_ledger
  DROP CONSTRAINT IF EXISTS host_credit_ledger_source_check;

ALTER TABLE host_credit_ledger
  ADD CONSTRAINT host_credit_ledger_source_check
  CHECK (source IN ('apple', 'google', 'stripe', 'admin', 'event_creation', 'adjustment'));
