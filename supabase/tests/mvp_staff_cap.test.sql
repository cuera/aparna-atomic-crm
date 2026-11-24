-- M-108: at most two active staff (Owner and Counsellor) until F-101 (ADR-A14).
-- Runs after Playwright on the same database in CI: Playwright leaves up to two active
-- sales rows, so this file disables every existing row first (note 2). All of it rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

update public.sales set disabled = true;

-- New staff arrive the way the app creates them: an invitation, then an auth user,
-- which handle_new_user turns into a sales row.
insert into public.user_invitations (user_id) values
  ('00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000000103');

select lives_ok(
  $$ insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000101', 'owner.cap@example.test') $$,
  'the first active staff account is accepted'
);
select lives_ok(
  $$ insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000102', 'counsellor.cap@example.test') $$,
  'the second active staff account is accepted'
);
select throws_like(
  $$ insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000103', 'teacher.cap@example.test') $$,
  '%ADR-A14%',
  'a third active staff account is refused with an error naming ADR-A14'
);
select throws_like(
  $$ insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000103', 'teacher.cap@example.test') $$,
  '%F-101%',
  'the refusal also names F-101'
);

-- Disabling one frees the slot
update public.sales set disabled = true where user_id = '00000000-0000-4000-8000-000000000101';
select lives_ok(
  $$ insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000103', 'replacement.cap@example.test') $$,
  'after disabling one account, a new one is accepted'
);

-- Re-enabling the disabled one would make three active
select throws_like(
  $$ update public.sales set disabled = false where user_id = '00000000-0000-4000-8000-000000000101' $$,
  '%ADR-A14%',
  're-enabling a third account is refused'
);

select is(
  (select count(*)::int from public.sales where not disabled),
  2,
  'exactly two staff accounts are active'
);

-- At the cap, editing an active account (the users function re-sends disabled = false) still works
select lives_ok(
  $$ update public.sales set disabled = false, first_name = 'Edited' where user_id = '00000000-0000-4000-8000-000000000102' $$,
  'saving an active account with disabled = false is accepted at the cap'
);
select lives_ok(
  $$ update public.sales set disabled = true where user_id = '00000000-0000-4000-8000-000000000101' $$,
  'disabling an account is always accepted'
);

select * from finish();
rollback;
