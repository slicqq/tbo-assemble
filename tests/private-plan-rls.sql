-- Only the isolated local tbo_private_test database; all test mutations roll back.
DO $$ BEGIN IF current_database() <> 'tbo_private_test' OR coalesce(host(inet_server_addr()),'127.0.0.1') NOT IN ('127.0.0.1','::1') THEN RAISE EXCEPTION 'Refusing outside isolated database'; END IF; END $$;
BEGIN;
INSERT INTO auth.users(id) VALUES ('a0000000-0000-4000-8000-000000000001'), ('b0000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
INSERT INTO public.private_inventory_plans(name,source,items,budget,risk,as_of,model_version) VALUES ('Alice','synthetic','[{}]',10000,.35,'2027-01-01','scenario-greedy-v2');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.private_inventory_plans) <> 1 THEN RAISE EXCEPTION 'owner read failed'; END IF;
 BEGIN INSERT INTO public.private_inventory_plans(owner_id,name,source,items,budget,risk,as_of,model_version) VALUES ('b0000000-0000-4000-8000-000000000002','spoof','synthetic','[{}]',1,0,'2027-01-01','scenario-greedy-v2'); RAISE EXCEPTION 'spoof succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.private_inventory_plans SET name='changed'; RAISE EXCEPTION 'update allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

END $$;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.private_inventory_plans) <> 0 THEN RAISE EXCEPTION 'cross-user read succeeded'; END IF; DELETE FROM public.private_inventory_plans WHERE name='Alice'; IF FOUND THEN RAISE EXCEPTION 'cross-user delete succeeded'; END IF; END $$;
INSERT INTO public.private_inventory_plans(name,source,items,budget,risk,as_of,model_version) VALUES ('Bob','uploaded','[{}]',10000,.35,'2027-01-01','scenario-greedy-v2');
DO $$ BEGIN IF (SELECT count(*) FROM public.private_inventory_plans) <> 1 OR (SELECT name FROM public.private_inventory_plans LIMIT 1) <> 'Bob' THEN RAISE EXCEPTION 'isolation failed'; END IF; DELETE FROM public.private_inventory_plans WHERE name='Bob'; IF NOT FOUND THEN RAISE EXCEPTION 'owner delete failed'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM public.private_inventory_plans; RAISE EXCEPTION 'anonymous read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
ROLLBACK;
