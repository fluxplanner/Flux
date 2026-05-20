-- P5-OPS: school operations intelligence — overload week prediction (aggregate only).

CREATE OR REPLACE FUNCTION public.flux_school_ops_overload_week()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  is_admin BOOLEAN;
  start_d DATE := CURRENT_DATE;
  end_d DATE := CURRENT_DATE + 6;
  active_cls INT;
  total_cnt INT;
  total_mins INT;
  cap_mins INT;
  week_ratio NUMERIC;
  week_lvl TEXT := 'ok';
  peak DATE;
  peak_cnt INT;
  peak_mins INT;
  days_json JSONB;
  wellness_high INT;
  wellness_avg NUMERIC;
  wellness_snaps INT;
  subs_pending INT;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = uid AND ur.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*)::int INTO active_cls FROM public.teacher_classes WHERE active = true;
  cap_mins := GREATEST(420, active_cls * 7 * 90);

  WITH day_series AS (
    SELECT (start_d + g.i)::date AS d
    FROM generate_series(0, 6) AS g(i)
  ),
  daily AS (
    SELECT
      ta.due_date AS d,
      COUNT(*)::int AS cnt,
      COALESCE(SUM(COALESCE(ta.estimated_minutes, 30)), 0)::int AS mins,
      COUNT(*) FILTER (WHERE ta.type IN ('quiz', 'test'))::int AS tests
    FROM public.teacher_assignments ta
    WHERE ta.visible = true
      AND ta.due_date BETWEEN start_d AND end_d
    GROUP BY ta.due_date
  ),
  joined AS (
    SELECT
      ds.d,
      COALESCE(d.cnt, 0) AS cnt,
      COALESCE(d.mins, 0) AS mins,
      COALESCE(d.tests, 0) AS tests
    FROM day_series ds
    LEFT JOIN daily d ON d.d = ds.d
  ),
  totals AS (
    SELECT
      COALESCE(SUM(cnt), 0)::int AS t_cnt,
      COALESCE(SUM(mins), 0)::int AS t_mins
    FROM joined
  ),
  peak_row AS (
    SELECT j.d, j.cnt, j.mins
    FROM joined j
    ORDER BY j.mins DESC, j.cnt DESC, j.d
    LIMIT 1
  ),
  avg_row AS (
    SELECT CASE WHEN t.t_mins > 0 THEN t.t_mins::numeric / 7.0 ELSE 0 END AS avg_mins
    FROM totals t
  )
  SELECT
    COALESCE((SELECT t_cnt FROM totals), 0),
    COALESCE((SELECT t_mins FROM totals), 0),
    (SELECT d FROM peak_row),
    COALESCE((SELECT cnt FROM peak_row), 0),
    COALESCE((SELECT mins FROM peak_row), 0),
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'date', j.d::text,
            'count', j.cnt,
            'est_minutes', j.mins,
            'tests', j.tests,
            'level',
            CASE
              WHEN j.mins >= 240 OR j.cnt >= 20 THEN 'high'
              WHEN j.mins >= GREATEST(120, (SELECT avg_mins * 1.4 FROM avg_row))
                OR j.cnt >= GREATEST(8, (SELECT CEIL((SELECT t_cnt FROM totals)::numeric / 7.0 * 1.5)))
              THEN 'elevated'
              ELSE 'ok'
            END
          )
          ORDER BY j.d
        ),
        '[]'::jsonb
      )
      FROM joined j
    )
  INTO total_cnt, total_mins, peak, peak_cnt, peak_mins, days_json;

  week_ratio := CASE WHEN cap_mins > 0 THEN total_mins::numeric / cap_mins ELSE 0 END;

  IF week_ratio >= 1.15 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(days_json) el
    WHERE el->>'level' = 'high'
  ) THEN
    week_lvl := 'high';
  ELSIF week_ratio >= 0.82 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(days_json) el
    WHERE el->>'level' = 'elevated'
  ) THEN
    week_lvl := 'elevated';
  END IF;

  SELECT COUNT(*)::int INTO wellness_snaps
  FROM public.student_wellness_snapshots
  WHERE snapshot_date >= start_d - 7;

  SELECT COUNT(*)::int INTO wellness_high
  FROM public.student_wellness_snapshots
  WHERE snapshot_date >= start_d - 7 AND load_score >= 80;

  SELECT ROUND(AVG(load_score)::numeric, 1) INTO wellness_avg
  FROM public.student_wellness_snapshots
  WHERE snapshot_date >= start_d - 7 AND load_score IS NOT NULL;

  SELECT COUNT(*)::int INTO subs_pending
  FROM public.student_completions WHERE status = 'submitted';

  RETURN jsonb_build_object(
    'ok', true,
    'generated_at', NOW(),
    'week_start', start_d,
    'week_end', end_d,
    'week_level', week_lvl,
    'week_ratio', week_ratio,
    'capacity_est_minutes', cap_mins,
    'active_classes', active_cls,
    'total_assignments', total_cnt,
    'total_est_minutes', total_mins,
    'peak_day', peak,
    'peak_day_count', peak_cnt,
    'peak_day_minutes', peak_mins,
    'days', days_json,
    'wellness', jsonb_build_object(
      'snapshots_7d', wellness_snaps,
      'high_load_count', wellness_high,
      'avg_load_score', wellness_avg
    ),
    'submissions_pending', subs_pending
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flux_school_ops_overload_week() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_school_ops_overload_week() TO authenticated;

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_school_ops', 'Admin operations intelligence — overload week prediction (aggregates only)', false, 'admin')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
