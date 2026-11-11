-- Run on the actual NABT Supabase project before publishing the Drive-video UI.
-- Keep legacy YouTube records and their watch-progress relationships intact.
ALTER TABLE public.resource_videos
  ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.resource_videos
  ALTER COLUMN youtube_id DROP NOT NULL;
ALTER TABLE public.resource_videos
  ADD CONSTRAINT resource_videos_valid_source
  CHECK (
    (youtube_id IS NOT NULL AND youtube_id ~ '^[A-Za-z0-9_-]{11}
-- IMPORTANT: The existing list_lecture_videos RPC returns an explicit column
-- signature in some deployments. Ensure it includes source_url in its response
-- before deploying the frontend; replace the RPC using its current SQL definition
-- and preserve its visibility/role checks. Do not expose hidden videos publicly.
)
    OR (source_url IS NOT NULL AND source_url ~ '^https://drive[.]google[.]com/file/d/[A-Za-z0-9_-]+/view
-- IMPORTANT: The existing list_lecture_videos RPC returns an explicit column
-- signature in some deployments. Ensure it includes source_url in its response
-- before deploying the frontend; replace the RPC using its current SQL definition
-- and preserve its visibility/role checks. Do not expose hidden videos publicly.
)
  );
-- IMPORTANT: The existing list_lecture_videos RPC returns an explicit column
-- signature in some deployments. Ensure it includes source_url in its response
-- before deploying the frontend; replace the RPC using its current SQL definition
-- and preserve its visibility/role checks. Do not expose hidden videos publicly.
