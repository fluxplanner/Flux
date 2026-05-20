-- Rename IAE school join code to IA-EAST (was IAE-EAST on early deploys).

UPDATE public.flux_schools
SET join_code = 'IA-EAST'
WHERE slug = 'iae' OR upper(trim(join_code)) IN ('IAE-EAST', 'IA-EAST');
