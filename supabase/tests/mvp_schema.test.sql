-- M-103: MVP columns, the next_action_at default, contacts_summary, and the deals_mvp_fields trigger.
-- Runs after Playwright on the same database in CI: it never assumes empty tables (note 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Columns (MVP.md section 4)
select col_type_is('public', 'deals', 'child_name', 'text', 'deals.child_name is text');
select col_type_is('public', 'deals', 'child_grade', 'text', 'deals.child_grade is text');
select col_type_is('public', 'deals', 'board', 'text', 'deals.board is text');
select col_type_is('public', 'deals', 'course', 'text', 'deals.course is text');
select col_type_is('public', 'deals', 'source', 'text', 'deals.source is text');
select col_type_is('public', 'deals', 'next_action_at', 'timestamp with time zone', 'deals.next_action_at is timestamptz');
select col_type_is('public', 'deals', 'lost_reason', 'text', 'deals.lost_reason is text');
select col_type_is('public', 'deals', 'trial_at', 'timestamp with time zone', 'deals.trial_at is timestamptz');
select col_type_is('public', 'deals', 'first_response_at', 'timestamp with time zone', 'deals.first_response_at is timestamptz');
select col_type_is('public', 'deals', 'enrolled_at', 'timestamp with time zone', 'deals.enrolled_at is timestamptz');
select col_type_is('public', 'deals', 'stage_changed_at', 'timestamp with time zone', 'deals.stage_changed_at is timestamptz');
select col_type_is('public', 'deals', 'fee_amount_paise', 'bigint', 'deals.fee_amount_paise is bigint (paise, never floats)');
select col_type_is('public', 'deals', 'fee_period', 'text', 'deals.fee_period is text');
select col_type_is('public', 'deals', 'next_fee_due', 'date', 'deals.next_fee_due is a date');
select col_type_is('public', 'contacts', 'country', 'text', 'contacts.country is text');
select col_default_is('public', 'contacts', 'timezone', 'Asia/Kolkata', 'contacts.timezone defaults to Asia/Kolkata');
select col_type_is('public', 'contacts', 'phone_e164', 'text', 'contacts.phone_e164 is text');
select col_default_is('public', 'contacts', 'whatsapp_opt_in', 'true', 'contacts.whatsapp_opt_in defaults to true');

-- contacts_summary still valid and exposes the new parent fields (Parents CSV export)
select has_column('public', 'contacts_summary', 'country', 'contacts_summary exposes country');
select has_column('public', 'contacts_summary', 'timezone', 'contacts_summary exposes timezone');
select has_column('public', 'contacts_summary', 'phone_e164', 'contacts_summary exposes phone_e164');
select has_column('public', 'contacts_summary', 'whatsapp_opt_in', 'contacts_summary exposes whatsapp_opt_in');
select col_not_null('public', 'contacts', 'whatsapp_opt_in', 'contacts.whatsapp_opt_in is never null');

-- next_action_at default is now() + 1 day (permanent DB default)
insert into public.deals (id, name, stage) values (-9001, 'x', 'enquiry');
select is(
  (select next_action_at from public.deals where id = -9001),
  now() + interval '1 day',
  'an insert without next_action_at gets now() + 1 day'
);

-- Stage trigger: insert sets stage_changed_at
select is(
  (select stage_changed_at from public.deals where id = -9001),
  now(),
  'insert sets stage_changed_at'
);

-- now() is constant inside a transaction: force an old value first, then check the trigger resets it
update public.deals set stage_changed_at = '2000-01-01' where id = -9001;
update public.deals set description = 'no stage change' where id = -9001;
select is(
  (select stage_changed_at from public.deals where id = -9001),
  '2000-01-01'::timestamptz,
  'an update that keeps the stage keeps stage_changed_at'
);

update public.deals set stage = 'trial_booked' where id = -9001;
select is(
  (select stage_changed_at from public.deals where id = -9001),
  now(),
  'a stage change resets stage_changed_at'
);
select is(
  (select enrolled_at from public.deals where id = -9001),
  null,
  'enrolled_at stays empty while the stage is not enrolled'
);

update public.deals set stage = 'enrolled' where id = -9001;
select is(
  (select enrolled_at from public.deals where id = -9001),
  now(),
  'moving to enrolled sets enrolled_at'
);

-- deals.name follows child_name (hidden name cannot drift)
update public.deals set child_name = '  Asha  ' where id = -9001;
select is(
  (select name from public.deals where id = -9001),
  'Asha',
  'updating child_name updates the hidden name'
);

-- Inserts: an enrolled insert (current students import) sets enrolled_at; name follows child_name
insert into public.deals (id, name, child_name, stage) values (-9002, 'placeholder', 'Ravi', 'enrolled');
select is(
  (select enrolled_at from public.deals where id = -9002),
  now(),
  'an insert straight into enrolled sets enrolled_at'
);
select is(
  (select name from public.deals where id = -9002),
  'Ravi',
  'an insert with child_name sets the hidden name'
);
insert into public.deals (id, name, child_name, stage) values (-9003, 'Kept name', '   ', 'enquiry');
select is(
  (select name from public.deals where id = -9003),
  'Kept name',
  'a blank child_name keeps the existing name'
);

select * from finish();
rollback;
