-- M-109: mark_fee_paid is a compare-and-set, SECURITY INVOKER, and closed to anon.
-- Runs after Playwright on the same database in CI: it only touches its own rows (note 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into public.deals (id, name, stage, fee_amount_paise, fee_period, next_fee_due)
values
  (-9201, 'Monthly child', 'enrolled', 250000, 'monthly', '2026-12-01'),
  (-9202, 'Quarterly child', 'enrolled', 700000, 'quarterly', '2026-12-01'),
  (-9203, 'No period child', 'enrolled', 300000, null, '2026-12-01'),
  (-9204, 'No due date child', 'enrolled', 300000, 'monthly', null);

-- Called the way the app calls it: as a signed-in user, under RLS
create temp table fee_calls (n int, applied boolean);
grant all on fee_calls to authenticated;
set local role authenticated;
insert into fee_calls select 1, public.mark_fee_paid(-9201, '2026-12-01');
insert into fee_calls select 2, public.mark_fee_paid(-9201, '2026-12-01');
insert into fee_calls select 3, public.mark_fee_paid(-9202, '2026-12-01');
reset role;

select is((select applied from fee_calls where n = 1), true, 'the first call with the shown due date applies');
select is((select applied from fee_calls where n = 2), false, 'a second call with the same shown due date returns false');
select is(
  (select next_fee_due from public.deals where id = -9201),
  '2027-01-01'::date,
  'two calls advance next_fee_due by exactly one month'
);
select is(
  (select count(*)::int from public.deal_notes where deal_id = -9201),
  1,
  'two calls write exactly one fee note'
);
select matches(
  (select text from public.deal_notes where deal_id = -9201),
  '^Fee paid: due 2026-12-01, next due 2027-01-01$',
  'the note records the paid and the next due date'
);
select is(
  (select next_fee_due from public.deals where id = -9202),
  '2027-03-01'::date,
  'quarterly advances by three months'
);

-- Grants and security mode
select is(
  (select prosecdef from pg_proc where oid = 'public.mark_fee_paid(bigint, date)'::regprocedure),
  false,
  'mark_fee_paid is SECURITY INVOKER'
);
select is(
  has_function_privilege('anon', 'public.mark_fee_paid(bigint, date)', 'execute'),
  false,
  'anon has no EXECUTE on mark_fee_paid'
);
select ok(
  (select proacl is not null
     and not exists (select 1 from aclexplode(proacl) where grantee = 0 and privilege_type = 'EXECUTE')
   from pg_proc where oid = 'public.mark_fee_paid(bigint, date)'::regprocedure),
  'PUBLIC has no EXECUTE on mark_fee_paid (explicit ACL without a PUBLIC entry)'
);

-- A due date without a fee period is an error, not "already updated", and changes nothing
select throws_like(
  $$ select public.mark_fee_paid(-9203, '2026-12-01') $$,
  '%no fee period%',
  'a due date without a fee period raises'
);
select is(
  (select next_fee_due from public.deals where id = -9203),
  '2026-12-01'::date,
  'the failed call leaves next_fee_due unchanged'
);
select is(
  (select count(*)::int from public.deal_notes where deal_id = -9203),
  0,
  'the failed call writes no note'
);
select is(public.mark_fee_paid(-9204, '2026-12-01'), false, 'an admission without a next fee due date returns false');
select is(
  has_function_privilege('authenticated', 'public.mark_fee_paid(bigint, date)', 'execute'),
  true,
  'authenticated may EXECUTE mark_fee_paid'
);

-- An anon call changes nothing
set local role anon;
do $$
begin
  perform public.mark_fee_paid(-9201, date '2027-01-01');
  perform set_config('mvp_test.anon_call', 'executed', true);
exception when insufficient_privilege then
  perform set_config('mvp_test.anon_call', 'denied', true);
end
$$;
reset role;
select is(current_setting('mvp_test.anon_call'), 'denied', 'an anon call is denied');
select is(
  (select next_fee_due from public.deals where id = -9201),
  '2027-01-01'::date,
  'an anon call leaves next_fee_due unchanged'
);
select is(
  (select count(*)::int from public.deal_notes where deal_id = -9201),
  1,
  'an anon call writes no note'
);

select * from finish();
rollback;
