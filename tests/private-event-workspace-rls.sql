\set ON_ERROR_STOP on
DO $$ BEGIN IF host(inet_server_addr()) <> '127.0.0.1' THEN RAISE EXCEPTION 'Local test database only'; END IF; END $$;
BEGIN;
INSERT INTO auth.users(id) VALUES ('a0000000-0000-4000-8000-000000000001'),('b0000000-0000-4000-8000-000000000002');
INSERT INTO public.private_event_drafts(id,owner_id,title,starts_on,ends_on) VALUES ('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','A event','2026-12-01','2026-12-02'), ('b1000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','B event','2026-12-01','2026-12-02');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
INSERT INTO public.private_event_room_blocks(event_id,hotel_name,room_type,total_qty,rate) VALUES ('a1000000-0000-4000-8000-000000000001','A hotel','Double',5,1200);
UPDATE public.private_event_drafts SET title='A changed' WHERE id='a1000000-0000-4000-8000-000000000001';
UPDATE public.private_event_room_blocks SET total_qty=6 WHERE event_id='a1000000-0000-4000-8000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.private_event_drafts)<>1 OR (SELECT count(*) FROM public.private_event_room_blocks)<>1 THEN RAISE EXCEPTION 'owner read failed'; END IF;
 BEGIN INSERT INTO public.private_event_room_blocks(event_id,hotel_name,room_type,total_qty,rate) VALUES ('b1000000-0000-4000-8000-000000000002','forged','Double',1,1); RAISE EXCEPTION 'cross-owner child insert succeeded'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.private_event_room_blocks(owner_id,event_id,hotel_name,room_type,total_qty,rate) VALUES ('b0000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','forged','Double',1,1); RAISE EXCEPTION 'owner spoof succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.private_event_room_blocks SET event_id='b1000000-0000-4000-8000-000000000002'; RAISE EXCEPTION 'child reparent succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.private_event_drafts SET owner_id='b0000000-0000-4000-8000-000000000002'; RAISE EXCEPTION 'event owner change succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM public.private_event_room_blocks)<>0 OR (SELECT count(*) FROM public.private_event_drafts)<>1 THEN RAISE EXCEPTION 'cross-user read'; END IF;
 UPDATE public.private_event_drafts SET title='forged' WHERE id='a1000000-0000-4000-8000-000000000001'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'cross-user update'; END IF;
 DELETE FROM public.private_event_room_blocks WHERE event_id='a1000000-0000-4000-8000-000000000001'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'cross-user room delete'; END IF;
 DELETE FROM public.private_event_drafts WHERE id='a1000000-0000-4000-8000-000000000001'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'cross-user event delete'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
DELETE FROM public.private_event_drafts WHERE id='a1000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.private_event_room_blocks) THEN RAISE EXCEPTION 'cascade failed'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM * FROM public.private_event_room_blocks; RAISE EXCEPTION 'anon room read succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
ROLLBACK;
