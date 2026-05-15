-- ════════════════════════════════════════════════════════════════════
-- FLUX PLANNER — ATOMIC AI QUOTA CHECK + INCREMENT
-- Replaces the check-then-increment race in ai-proxy. All concurrent
-- requests from the same user serialize on a per-user advisory lock,
-- guaranteeing a user can never spend more than their daily/monthly
-- allowance even with bursty parallel calls.
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  p_user_id        UUID,
  p_daily_limit    INTEGER,
  p_monthly_limit  INTEGER
) RETURNS TABLE (
  allowed         BOOLEAN,
  daily_used      INTEGER,
  monthly_used    INTEGER,
  daily_limit     INTEGER,
  monthly_limit   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today      DATE := CURRENT_DATE;
  v_month      TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_daily      INTEGER;
  v_monthly    INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- Per-user advisory lock so concurrent ai-proxy calls serialize.
  -- Released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Ensure today's row exists, then take a row-level lock for the
  -- read so the count we observe matches what we will write.
  INSERT INTO public.ai_usage (user_id, date, month_year, message_count)
  VALUES (p_user_id, v_today, v_month, 0)
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT message_count INTO v_daily
  FROM public.ai_usage
  WHERE user_id = p_user_id AND date = v_today
  FOR UPDATE;

  SELECT COALESCE(SUM(message_count), 0)::INTEGER INTO v_monthly
  FROM public.ai_usage
  WHERE user_id = p_user_id AND month_year = v_month;

  IF v_daily >= COALESCE(p_daily_limit, 0)
     OR v_monthly >= COALESCE(p_monthly_limit, 0) THEN
    RETURN QUERY SELECT
      FALSE,
      v_daily,
      v_monthly,
      p_daily_limit,
      p_monthly_limit;
    RETURN;
  END IF;

  UPDATE public.ai_usage
  SET message_count = message_count + 1
  WHERE user_id = p_user_id AND date = v_today;

  RETURN QUERY SELECT
    TRUE,
    v_daily + 1,
    v_monthly + 1,
    p_daily_limit,
    p_monthly_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_usage(UUID, INTEGER, INTEGER)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(UUID, INTEGER, INTEGER)
  TO service_role;

-- Optional refund (e.g. AI provider error) — same per-user lock,
-- never goes below zero.
CREATE OR REPLACE FUNCTION public.refund_ai_usage(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  UPDATE public.ai_usage
  SET message_count = GREATEST(0, message_count - 1)
  WHERE user_id = p_user_id AND date = v_today;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_ai_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_ai_usage(UUID) TO service_role;
