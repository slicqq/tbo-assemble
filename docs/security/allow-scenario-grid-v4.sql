-- Additive model-version support; legacy saved plans and RLS are unchanged.
ALTER TABLE public.private_inventory_plans DROP CONSTRAINT private_inventory_plans_model_version_check;
ALTER TABLE public.private_inventory_plans ADD CONSTRAINT private_inventory_plans_model_version_check
 CHECK (model_version IN ('scenario-greedy-v2','scenario-grid-v3','scenario-grid-v4'));
