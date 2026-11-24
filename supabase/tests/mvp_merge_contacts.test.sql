-- Owner amendment 1: merge_contacts carries the MVP parent fields; closed to anon.
-- Runs after Playwright on the same database in CI: it only touches its own rows (note 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.contacts (id, first_name, country, timezone, phone_e164, whatsapp_opt_in) values
  (-9301, 'Winner A', null, 'Asia/Kolkata', null, true),
  (-9302, 'Loser A', 'United Kingdom', 'Europe/London', '+447700900123', false),
  (-9303, 'Winner B', 'India', 'Asia/Kolkata', '+919800000301', false),
  (-9304, 'Loser B', 'United Arab Emirates', 'Asia/Dubai', '+971501234301', true),
  (-9305, 'Winner C', null, 'Asia/Kolkata', null, true),
  (-9306, 'Loser C', null, 'Asia/Kolkata', null, true);

-- Merged the way the app does it: the edge function runs the SQL function as authenticated
create temp table merges (n int, winner bigint);
grant all on merges to authenticated;
set local role authenticated;
insert into merges select 1, public.merge_contacts(-9302, -9301);
insert into merges select 2, public.merge_contacts(-9304, -9303);
insert into merges select 3, public.merge_contacts(-9306, -9305);
reset role;

select is((select count(*)::int from merges), 3, 'authenticated can merge parents');
select is(
  (select phone_e164 from public.contacts where id = -9301),
  '+447700900123',
  'the winner takes the loser''s phone_e164 when it has none (no unique-index conflict)'
);
select is(
  (select whatsapp_opt_in from public.contacts where id = -9301),
  false,
  'an opt-out on the loser survives the merge'
);
select is(
  (select country from public.contacts where id = -9301),
  'United Kingdom',
  'the winner takes the loser''s country when it has none'
);
select is(
  (select timezone from public.contacts where id = -9301),
  'Asia/Kolkata',
  'the winner keeps its own time zone'
);
select is(
  (select phone_e164 from public.contacts where id = -9303),
  '+919800000301',
  'the winner keeps its own phone_e164 when both have one'
);
select is(
  (select whatsapp_opt_in from public.contacts where id = -9303),
  false,
  'an opt-out on the winner survives the merge'
);
select is(
  (select whatsapp_opt_in from public.contacts where id = -9305),
  true,
  'two opted-in parents stay opted in'
);
select is(
  (select count(*)::int from public.contacts where id in (-9302, -9304, -9306)),
  0,
  'the losers are deleted'
);
select is(
  has_function_privilege('authenticated', 'public.merge_contacts(bigint, bigint)', 'execute'),
  true,
  'authenticated may EXECUTE merge_contacts'
);
select is(
  has_function_privilege('anon', 'public.merge_contacts(bigint, bigint)', 'execute'),
  false,
  'anon has no EXECUTE on merge_contacts'
);
select ok(
  (select proacl is not null
     and not exists (select 1 from aclexplode(proacl) where grantee = 0 and privilege_type = 'EXECUTE')
   from pg_proc where oid = 'public.merge_contacts(bigint, bigint)'::regprocedure),
  'PUBLIC has no EXECUTE on merge_contacts'
);

select * from finish();
rollback;
