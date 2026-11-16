-- Additive model-version support for the portfolio risk engine (risk-cvar-v5).
-- Legacy saved plans, grants and row-level security policies are unchanged.
-- Saved snapshots still store inputs only; results are recalculated when reopened.
ALTER TABLE public.private_inventory_plans DROP CONSTRAINT private_inventory_plans_model_version_check;
ALTER TABLE public.private_inventory_plans ADD CONSTRAINT private_inventory_plans_model_version_check
 CHECK (model_version IN ('scenario-greedy-v2','scenario-grid-v3','scenario-grid-v4','risk-cvar-v5'));
