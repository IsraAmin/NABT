-- NABT: preserve historical YouTube rows; add Google Drive video sources.
ALTER TABLE public.resource_videos ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.resource_videos ALTER COLUMN youtube_id DROP NOT NULL;
ALTER TABLE public.resource_videos DROP CONSTRAINT IF EXISTS resource_videos_valid_source;
ALTER TABLE public.resource_videos ADD CONSTRAINT resource_videos_valid_source CHECK (
 (youtube_id IS NOT NULL AND youtube_id ~ '^[A-Za-z0-9_-]{11}$' AND source_url IS NULL)
 OR (youtube_id IS NULL AND source_url ~ '^https://drive[.]google[.]com/file/d/[A-Za-z0-9_-]+/view$')
);
-- Existing list_lecture_videos RPC can continue serving YouTube.
-- The authenticated client also loads Drive videos through the existing
-- resource_videos SELECT RLS policy and never exposes hidden items.
