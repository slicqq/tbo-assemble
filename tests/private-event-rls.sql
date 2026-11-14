-- Run only against the isolated local tbo_private_test database, never production.
DO $$ BEGIN IF current_database() <> 'tbo_private_test' OR coalesce(inet_server_addr()::text, '127.0.0.1') NOT IN ('127.0.0.1', '::1') THEN RAISE EXCEPTION 'Refusing to run outside isolated local test database'; END IF; END $$;
BEGIN;
INSERT INTO auth.users(id) VALUES ('a0000000-0000-4000-8000-000000000001'), ('b0000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
INSERT INTO public.private_event_drafts (title,location,starts_on,ends_on) VALUES ('Alice draft','A','2027-01-01','2027-01-02');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.private_event_drafts) <> 1 THEN RAISE EXCEPTION 'owner cannot read own row'; END IF;
 BEGIN INSERT INTO public.private_event_drafts(owner_id,title,starts_on,ends_on) VALUES ('b0000000-0000-4000-8000-000000000002','forged','2027-01-01','2027-01-02'); RAISE EXCEPTION 'owner spoof succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.private_event_drafts SET title='changed'; RAISE EXCEPTION 'update allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.private_event_drafts; RAISE EXCEPTION 'delete allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.private_event_drafts) <> 0 THEN RAISE EXCEPTION 'cross-user read succeeded'; END IF; END $$;
INSERT INTO public.private_event_drafts (title,starts_on,ends_on) VALUES ('Bob draft','2027-02-01','2027-02-02');
DO $$ BEGIN IF (SELECT count(*) FROM public.private_event_drafts) <> 1 OR (SELECT title FROM public.private_event_drafts LIMIT 1) <> 'Bob draft' THEN RAISE EXCEPTION 'wrong user isolation'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM public.private_event_drafts; RAISE EXCEPTION 'anonymous read succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
ROLLBACK;
