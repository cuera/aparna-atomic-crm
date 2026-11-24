-- Owner amendment 1: merge_contacts carries the MVP parent fields; closed to anon.
-- Runs after Playwright on the same database in CI: it only touches its own rows (note 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.contacts (id, first_name, country, timezone, phone_e164, whatsapp_opt_in) values
  (-9301, 'Winner', null, 'Asia/Kolkata', null, true),
  (-9302, 'Loser', 'United Kingdom', 'Europe/London', '+447700900123', false);

select lives_ok(
  $$ select public.merge_contacts(-9302, -9301) $$,
  'merging a loser that owns a phone_e164 into a winner without one succeeds'
);
select is(
  (select phone_e164 from public.contacts where id = -9301),
  '+447700900123',
  'the winner keeps the loser''s phone_e164'
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
  (select count(*)::int from public.contacts where id = -9302),
  0,
  'the loser is deleted'
);
select is(
  has_function_privilege('anon', 'public.merge_contacts(bigint, bigint)', 'execute'),
  false,
  'anon has no EXECUTE on merge_contacts'
);

select * from finish();
rollback;
