-- Turn on propose-then-confirm for AI planner writes.
--
-- The actual cause of writes still applying silently was a fallback in
-- flux-agent-loop.js: isEnabled(key, fallback) returns the caller's fallback
-- *before* it consults the client defaults, and that call passed false, so the
-- default of true was never reached. That is fixed at the call site.
--
-- This row is aligned for the same reason: remote flag values win over client
-- defaults, so leaving it false would let a future flag sync silently switch
-- confirmation back off — reintroducing exactly the behaviour being fixed here
-- (a student asks for a task and it simply appears, with no Apply/Cancel card).
--
-- The feature itself has existed since P0 A4; it was built and left off.

UPDATE public.flux_feature_flags
   SET default_enabled = true,
       description = 'AI planner writes become an Apply/Cancel proposal card with undo — Flux asks before changing the planner'
 WHERE key = 'enable_ai_action_confirm';

-- Register it if this database predates the flag.
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category)
SELECT
  'enable_ai_action_confirm',
  'AI planner writes become an Apply/Cancel proposal card with undo — Flux asks before changing the planner',
  true,
  'student'
WHERE NOT EXISTS (
  SELECT 1 FROM public.flux_feature_flags WHERE key = 'enable_ai_action_confirm'
);
