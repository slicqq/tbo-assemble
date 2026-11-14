-- Only run against isolated tbo_private_test after applying the v4 migration.
DO $$ BEGIN IF current_database() <> 'tbo_private_test' OR coalesce(host(inet_server_addr()),'127.0.0.1') NOT IN ('127.0.0.1','::1') THEN RAISE EXCEPTION 'Refusing outside isolated database'; END IF; END $$;
BEGIN;
INSERT INTO auth.users(id) VALUES ('a0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
INSERT INTO public.private_inventory_plans(name,source,items,budget,risk,as_of,model_version) VALUES ('New','synthetic','[{"minOrderUnits":3,"fixedOrderFee":50}]',1000,.35,'2026-11-13','scenario-grid-v4');
INSERT INTO public.private_inventory_plans(name,source,items,budget,risk,as_of,model_version) VALUES ('Old','synthetic','[{}]',1000,.35,'2026-11-13','scenario-grid-v3');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.private_inventory_plans) <> 2 THEN RAISE EXCEPTION 'version read failed'; END IF;
 BEGIN INSERT INTO public.private_inventory_plans(name,source,items,budget,risk,as_of,model_version) VALUES ('Bad','synthetic','[{}]',1,0,'2026-11-13','invented'); RAISE EXCEPTION 'bad version accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
