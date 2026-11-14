-- Additive private event workspace. Legacy Event and guest links are untouched.
-- Owner and event identity are immutable to authenticated users.
ALTER TABLE public.private_event_drafts ADD CONSTRAINT private_event_drafts_id_owner_unique UNIQUE (id, owner_id);
GRANT UPDATE (title, location, starts_on, ends_on) ON public.private_event_drafts TO authenticated;
GRANT DELETE ON public.private_event_drafts TO authenticated;
CREATE POLICY private_draft_update_own ON public.private_event_drafts FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY private_draft_delete_own ON public.private_event_drafts FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE TABLE public.private_event_room_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  hotel_name text NOT NULL CHECK (char_length(btrim(hotel_name)) BETWEEN 1 AND 120),
  room_type text NOT NULL CHECK (char_length(btrim(room_type)) BETWEEN 1 AND 120),
  total_qty integer NOT NULL CHECK (total_qty BETWEEN 1 AND 10000),
  rate numeric(12,2) NOT NULL CHECK (rate >= 0 AND rate <= 10000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_room_owner_event_fk FOREIGN KEY (event_id, owner_id) REFERENCES public.private_event_drafts(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX private_room_owner_event_idx ON public.private_event_room_blocks(owner_id, event_id);
ALTER TABLE public.private_event_room_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_event_room_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.private_event_room_blocks TO authenticated;
GRANT INSERT (event_id, hotel_name, room_type, total_qty, rate) ON public.private_event_room_blocks TO authenticated;
GRANT UPDATE (hotel_name, room_type, total_qty, rate) ON public.private_event_room_blocks TO authenticated;
CREATE POLICY private_room_select_own ON public.private_event_room_blocks FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY private_room_insert_own ON public.private_event_room_blocks FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY private_room_update_own ON public.private_event_room_blocks FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY private_room_delete_own ON public.private_event_room_blocks FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
