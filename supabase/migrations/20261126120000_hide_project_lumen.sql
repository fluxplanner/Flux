-- Project Lumen (lumen.html), a Flux partner site, starts hidden: only the
-- owner, and anyone the owner gives a role with app:lumen, sees it until the
-- owner shows it from Owner Controls → Hide apps.
INSERT INTO public.flux_hidden_apps (app_id) VALUES ('lumen') ON CONFLICT DO NOTHING;
