-- Additive standalone draft store; does not modify or claim legacy Event records.
-- Apply once with a reviewed migration. Uses caller's Supabase JWT, never Prisma.
CREATE TABLE public.private_event_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 120),
  starts_on date NOT NULL CHECK (starts_on >= DATE '1900-01-01' AND starts_on <= DATE '2100-12-31'),
  ends_on date NOT NULL CHECK (ends_on >= starts_on AND ends_on <= DATE '2100-12-31'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX private_event_drafts_owner_created_idx ON public.private_event_drafts (owner_id, created_at DESC);
ALTER TABLE public.private_event_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_event_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.private_event_drafts TO authenticated;
-- Owners and IDs are database-generated and cannot be supplied by the caller.
GRANT INSERT (title, location, starts_on, ends_on) ON public.private_event_drafts TO authenticated;
CREATE POLICY private_draft_select_own ON public.private_event_drafts FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY private_draft_insert_own ON public.private_event_drafts FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
