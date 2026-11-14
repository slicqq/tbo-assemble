-- Additive snapshot storage: does not touch legacy events or bookings.
CREATE TABLE public.private_inventory_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
 source text NOT NULL CHECK (source IN ('synthetic', 'uploaded')),
 items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 20 AND octet_length(items::text) <= 100000),
 budget bigint NOT NULL CHECK (budget BETWEEN 0 AND 1000000000),
 risk double precision NOT NULL CHECK (risk BETWEEN 0 AND 0.8),
 as_of date NOT NULL CHECK (as_of BETWEEN DATE '1900-01-01' AND DATE '2100-12-31'),
 model_version text NOT NULL CHECK (model_version IN ('scenario-greedy-v2', 'scenario-grid-v3')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX private_inventory_plans_owner_created_idx ON public.private_inventory_plans (owner_id, created_at DESC);
ALTER TABLE public.private_inventory_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_inventory_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.private_inventory_plans TO authenticated;
GRANT INSERT (name, source, items, budget, risk, as_of, model_version) ON public.private_inventory_plans TO authenticated;
CREATE POLICY private_plan_select_own ON public.private_inventory_plans FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY private_plan_insert_own ON public.private_inventory_plans FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY private_plan_delete_own ON public.private_inventory_plans FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
