-- Ghost drafts removed completely (owner's call, 2026-10-26): the legacy
-- AI starting points on task cards, Ghost draft v2 and its Google Docs sync.
-- Their flags go too; school and user overrides follow by ON DELETE CASCADE.
-- Applied to the FluxPlanner project on 2026-10-26 as migration
-- "retire_ghost_draft_flags".

DELETE FROM public.flux_feature_flags
WHERE key IN ('enable_ghost_draft_v2', 'enable_docs_ghost_sync');
