CREATE TABLE IF NOT EXISTS billing_customers (
  member_id uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  revenuecat_app_user_id text UNIQUE,
  revenuecat_original_app_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_entitlements (
  member_id uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  premium_active boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'none' CHECK (source IN ('apple', 'stripe', 'admin', 'none')),
  started_at timestamptz,
  expires_at timestamptz,
  original_transaction_ref text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS host_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  source text NOT NULL CHECK (source IN ('apple', 'stripe', 'admin', 'event_creation', 'adjustment')),
  purchase_ref text,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS host_credit_ledger_unique_purchase_ref_idx
  ON host_credit_ledger (source, purchase_ref)
  WHERE purchase_ref IS NOT NULL AND source IN ('apple', 'stripe');

CREATE INDEX IF NOT EXISTS host_credit_ledger_member_created_idx
  ON host_credit_ledger (member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  provider text NOT NULL CHECK (provider IN ('stripe', 'revenuecat')),
  event_id text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own billing customer" ON billing_customers
  FOR SELECT TO authenticated
  USING (auth.uid() = member_id);

CREATE POLICY "Members can read own entitlements" ON member_entitlements
  FOR SELECT TO authenticated
  USING (auth.uid() = member_id);

CREATE POLICY "Members can read own host credit ledger" ON host_credit_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = member_id);

CREATE OR REPLACE FUNCTION get_my_billing_status()
RETURNS TABLE (
  premium_active boolean,
  premium_source text,
  premium_expires_at timestamptz,
  host_credit_balance bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid := auth.uid();
BEGIN
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(e.premium_active, false) AS premium_active,
    COALESCE(e.source, 'none') AS premium_source,
    e.expires_at AS premium_expires_at,
    COALESCE(SUM(l.delta), 0)::bigint AS host_credit_balance
  FROM members m
  LEFT JOIN member_entitlements e ON e.member_id = m.id
  LEFT JOIN host_credit_ledger l ON l.member_id = m.id
  WHERE m.id = v_member_id
  GROUP BY e.premium_active, e.source, e.expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_billing_status() TO authenticated;

CREATE OR REPLACE FUNCTION create_hosted_event(
  p_title text,
  p_theme text,
  p_date date,
  p_tasting_mode text DEFAULT 'single_blind',
  p_description text DEFAULT NULL,
  p_partiful_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid := auth.uid();
  v_balance bigint := 0;
  v_event_id uuid;
BEGIN
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM 1 FROM members WHERE id = v_member_id FOR UPDATE;

  SELECT COALESCE(SUM(delta), 0)::bigint
  INTO v_balance
  FROM host_credit_ledger
  WHERE member_id = v_member_id;

  IF v_balance < 1 THEN
    RAISE EXCEPTION 'You need a host credit to create an event';
  END IF;

  INSERT INTO events (
    title,
    theme,
    date,
    status,
    created_by,
    tasting_mode,
    description,
    partiful_url,
    event_image_status
  )
  VALUES (
    p_title,
    COALESCE(NULLIF(p_theme, ''), 'Tasting'),
    p_date,
    'active',
    v_member_id,
    COALESCE(NULLIF(p_tasting_mode, ''), 'single_blind')::text,
    p_description,
    p_partiful_url,
    'pending'
  )
  RETURNING id INTO v_event_id;

  INSERT INTO event_members (event_id, member_id, checked_in)
  VALUES (v_event_id, v_member_id, true)
  ON CONFLICT (event_id, member_id)
  DO UPDATE SET checked_in = EXCLUDED.checked_in;

  INSERT INTO host_credit_ledger (member_id, delta, source, event_id, metadata)
  VALUES (
    v_member_id,
    -1,
    'event_creation',
    v_event_id,
    jsonb_build_object('title', p_title, 'date', p_date)
  );

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_hosted_event(text, text, date, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION grant_host_credits(
  p_member_id uuid,
  p_quantity integer,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin FROM members WHERE id = v_requester_id;
  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Only admins can grant host credits';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Grant quantity must be at least 1';
  END IF;

  INSERT INTO host_credit_ledger (member_id, delta, source, metadata)
  VALUES (
    p_member_id,
    p_quantity,
    'admin',
    jsonb_build_object('reason', p_reason, 'granted_by', v_requester_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION grant_host_credits(uuid, integer, text) TO authenticated;
