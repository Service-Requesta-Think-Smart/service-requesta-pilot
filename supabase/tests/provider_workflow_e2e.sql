-- End-to-end + adversarial provider workflow test. Always rolls back (final RAISE).
-- Success message: E2E_OK <n> checks. Any other error = failure.
DO $t$
DECLARE c uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); x uuid:=gen_random_uuid();
 r uuid; q1 uuid; q2 uuid; cs uuid; n int:=0; s text; ok boolean;
BEGIN
 INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data,created_at,updated_at) VALUES
  (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','e2e-c@test.invalid',now(),'{}',now(),now()),
  (p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','e2e-p@test.invalid',now(),'{"account_type":"provider"}',now(),now()),
  (p2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','e2e-p2@test.invalid',now(),'{"account_type":"provider"}',now(),now()),
  (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','e2e-a@test.invalid',now(),'{}',now(),now()),
  (x,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','e2e-x@test.invalid',now(),'{}',now(),now());
 INSERT INTO public.user_roles(user_id,role) VALUES(a,'admin');
 INSERT INTO public.consents(user_id,privacy_version) SELECT u,'pilot-privacy-v1' FROM unnest(ARRAY[c,p,p2,a,x]) u;
 UPDATE public.feature_flags SET enabled=true WHERE name IN ('public_bookings','legal_approval','commission_enforcement');
 INSERT INTO public.commission_versions(rate_bps,base_definition,legal_approved) VALUES(1500,'approved_quote_total_cents',true);
 PERFORM set_config('role','authenticated',true);

 -- helper: switch user
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p,'role','authenticated')::text,true);
 PERFORM public.submit_provider_application('E2E Plumbing','plumbing','Beacon Bay','Weekdays 8-17','Ten years of plumbing work, references available',true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p2,'role','authenticated')::text,true);
 PERFORM public.submit_provider_application('E2E Second','plumbing','Beacon Bay','Weekends','Five years of general plumbing experience',true);

 -- Admin: cannot approve without both separate checks; non-admin cannot review
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p2,'role','authenticated')::text,true);
 BEGIN PERFORM public.review_provider_application(p,'approved','checked','reviewed','self'); RAISE EXCEPTION 'FAIL non-admin review'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 BEGIN PERFORM public.review_provider_application(p,'approved','checked','pending','identity only'); RAISE EXCEPTION 'FAIL approve without trade review'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM public.review_provider_application(p,'approved','checked','reviewed','Identity and trade evidence reviewed separately');
 PERFORM public.review_provider_application(p2,'approved','checked','reviewed','Second provider reviewed');
 n:=n+1;

 -- Customer creates request
 PERFORM set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated')::text,true);
 r:=public.marketplace_create_request('plumbing','Leaking kitchen tap','The kitchen tap drips constantly and needs repair.','Beacon Bay','this_week','12 Test Road, Beacon Bay','+27821234567',true,gen_random_uuid());
 -- Provider cannot see private details before approval
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p,'role','authenticated')::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.service_requests WHERE id=r) THEN RAISE EXCEPTION 'FAIL provider inbox missing request'; END IF; n:=n+1;
 IF EXISTS(SELECT 1 FROM public.request_private_details WHERE request_id=r) THEN RAISE EXCEPTION 'FAIL private details readable'; END IF; n:=n+1;
 BEGIN PERFORM public.marketplace_get_provider_contact(r); RAISE EXCEPTION 'FAIL contact before approval'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 -- p2 declines, p accepts; p2 then cannot quote
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p2,'role','authenticated')::text,true);
 PERFORM public.marketplace_respond_to_request(r,'declined');
 BEGIN PERFORM public.marketplace_respond_to_request(r,'accepted'); RAISE EXCEPTION 'FAIL double response'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p,'role','authenticated')::text,true);
 BEGIN PERFORM public.marketplace_advance_job(r,'in_progress'); RAISE EXCEPTION 'FAIL start before accept'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM public.marketplace_respond_to_request(r,'accepted');
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p2,'role','authenticated')::text,true);
 BEGIN PERFORM public.marketplace_submit_quote(r,'Replace washer and reseat the kitchen tap',15000,55000,30000,true,'Standard washer','Within 3 days',null); RAISE EXCEPTION 'FAIL non-assigned quote'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 -- Provider quotes; negative / zero amounts rejected
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p,'role','authenticated')::text,true);
 BEGIN PERFORM public.marketplace_submit_quote(r,'Replace washer and reseat the kitchen tap',-1,55000,30000,false,'Standard washer','Within 3 days',null); RAISE EXCEPTION 'FAIL negative amount'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 q1:=public.marketplace_submit_quote(r,'Replace washer and reseat the kitchen tap',15000,55000,30000,true,'Standard washer','Within 3 days',null);
 IF (SELECT total_cents FROM public.quotes WHERE id=q1)<>100000 THEN RAISE EXCEPTION 'FAIL total'; END IF; n:=n+1;
 BEGIN UPDATE public.quotes SET labour_cents=1 WHERE id=q1; RAISE EXCEPTION 'FAIL quote editable'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 q2:=public.marketplace_submit_quote(r,'Replace washer, cartridge and reseat the tap',15000,60000,35000,true,'Cartridge may be needed','Within 3 days',null);
 -- Customer: provider cannot approve; stale version rejected; both confirmations required
 BEGIN PERFORM public.marketplace_approve_quote(r,q2,true,true); RAISE EXCEPTION 'FAIL provider approves'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated')::text,true);
 BEGIN PERFORM public.marketplace_approve_quote(r,q1,true,true); RAISE EXCEPTION 'FAIL stale quote approved'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 BEGIN PERFORM public.marketplace_approve_quote(r,q2,true,false); RAISE EXCEPTION 'FAIL price not confirmed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 BEGIN UPDATE public.service_requests SET status='approved' WHERE id=r; RAISE EXCEPTION 'FAIL direct status write'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM public.marketplace_approve_quote(r,q2,true,true);
 BEGIN UPDATE public.approved_quotes SET snapshot='{}' WHERE request_id=r; RAISE EXCEPTION 'FAIL snapshot editable'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 IF (SELECT (snapshot->>'total_cents')::bigint FROM public.approved_quotes WHERE request_id=r)<>110000 THEN RAISE EXCEPTION 'FAIL snapshot total'; END IF; n:=n+1;
 -- Contact now available to assigned provider only
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p,'role','authenticated')::text,true);
 BEGIN PERFORM public.marketplace_submit_quote(r,'Sneaky post-approval revision of scope',1,1,1,false,'none','now',null); RAISE EXCEPTION 'FAIL quote after approval'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 IF (SELECT contact_phone FROM public.marketplace_get_provider_contact(r))<>'+27821234567' THEN RAISE EXCEPTION 'FAIL contact after approval'; END IF; n:=n+1;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p2,'role','authenticated')::text,true);
 BEGIN PERFORM public.marketplace_get_provider_contact(r); RAISE EXCEPTION 'FAIL other provider contact'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 IF EXISTS(SELECT 1 FROM public.service_requests WHERE id=r) THEN RAISE EXCEPTION 'FAIL decliner sees job'; END IF; n:=n+1;
 -- Outsider isolation
 PERFORM set_config('request.jwt.claims',json_build_object('sub',x,'role','authenticated')::text,true);
 IF EXISTS(SELECT 1 FROM public.quotes WHERE request_id=r) OR EXISTS(SELECT 1 FROM public.approved_quotes WHERE request_id=r) OR EXISTS(SELECT 1 FROM public.request_private_details WHERE request_id=r) THEN RAISE EXCEPTION 'FAIL outsider reads job data'; END IF; n:=n+1;
 BEGIN PERFORM public.marketplace_open_dispute(r,'Outsider tries to dispute somebody else job'); RAISE EXCEPTION 'FAIL outsider dispute'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 -- Job progression and completion
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p,'role','authenticated')::text,true);
 BEGIN PERFORM public.marketplace_advance_job(r,'awaiting_completion'); RAISE EXCEPTION 'FAIL skip in_progress'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM public.marketplace_advance_job(r,'in_progress');
 PERFORM public.marketplace_advance_job(r,'awaiting_completion');
 s:=public.marketplace_confirm_completion(r);
 IF s<>'awaiting_other_party' THEN RAISE EXCEPTION 'FAIL one-party completion'; END IF; n:=n+1;
 BEGIN PERFORM public.marketplace_confirm_completion(r); RAISE EXCEPTION 'FAIL double confirm'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 -- Customer disputes instead -> paused, not completed
 PERFORM set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated')::text,true);
 cs:=public.marketplace_open_dispute(r,'The tap still leaks after the work was done.');
 IF (SELECT status FROM public.service_requests WHERE id=r)<>'disputed' THEN RAISE EXCEPTION 'FAIL dispute status'; END IF; n:=n+1;
 BEGIN PERFORM public.marketplace_confirm_completion(r); RAISE EXCEPTION 'FAIL complete while disputed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 BEGIN PERFORM public.admin_resolve_support_case(cs,'customer resolves own case','resume'); RAISE EXCEPTION 'FAIL customer resolves'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 -- Admin resolves with reason; audit recorded
 PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 BEGIN PERFORM public.admin_resolve_support_case(cs,'no','resume'); RAISE EXCEPTION 'FAIL resolve without reason'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; n:=n+1; END;
 PERFORM public.admin_resolve_support_case(cs,'Provider returned and fixed the leak; resume completion checks','resume');
 IF (SELECT status FROM public.service_requests WHERE id=r)<>'awaiting_completion' THEN RAISE EXCEPTION 'FAIL resume'; END IF; n:=n+1;
 IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE action='support_case_resolved' AND entity_id=cs AND actor_id=a) THEN RAISE EXCEPTION 'FAIL audit'; END IF; n:=n+1;
 BEGIN DELETE FROM public.audit_events WHERE entity_id=cs; IF FOUND THEN RAISE EXCEPTION 'FAIL audit deletable'; END IF; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END; n:=n+1;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated')::text,true);
 s:=public.marketplace_confirm_completion(r);
 IF s<>'completed' OR (SELECT status FROM public.service_requests WHERE id=r)<>'completed' THEN RAISE EXCEPTION 'FAIL two-party completion'; END IF; n:=n+1;
 -- Support case visibility: outsider cannot read
 PERFORM set_config('request.jwt.claims',json_build_object('sub',x,'role','authenticated')::text,true);
 IF EXISTS(SELECT 1 FROM public.support_cases WHERE id=cs) THEN RAISE EXCEPTION 'FAIL outsider reads case'; END IF; n:=n+1;
 RAISE EXCEPTION 'E2E_OK % checks', n;
END $t$;
