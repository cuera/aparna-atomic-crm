-- M-104 plus Owner amendments 2 and 3: next-action, lost-reason, phone and fee checks.
-- Runs after Playwright on the same database in CI: it never assumes empty tables (note 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- deals_open_needs_next_action
select throws_like(
  $$ insert into public.deals (name, stage, next_action_at) values ('x', 'enquiry', null) $$,
  '%deals_open_needs_next_action%',
  'an open stage with an explicit null next_action_at is rejected'
);
select throws_like(
  $$ insert into public.deals (name, stage, next_action_at) values ('x', 'opportunity', null) $$,
  '%deals_open_needs_next_action%',
  'an unknown stage (upstream opportunity) without next_action_at is rejected (closed list)'
);
insert into public.deals (id, name, stage) values (-9101, 'x', 'trial_done');
select isnt(
  (select next_action_at from public.deals where id = -9101), null,
  'an insert without next_action_at gets the default'
);
select throws_like(
  $$ update public.deals set next_action_at = null where id = -9101 $$,
  '%deals_open_needs_next_action%',
  'clearing next_action_at on an open stage is rejected'
);
select lives_ok(
  $$ insert into public.deals (name, stage, next_action_at) values ('x', 'enrolled', null) $$,
  'enrolled without next_action_at is accepted'
);

-- deals_lost_needs_reason
select throws_like(
  $$ insert into public.deals (name, stage, next_action_at) values ('x', 'lost', null) $$,
  '%deals_lost_needs_reason%',
  'lost without lost_reason is rejected'
);
select throws_like(
  $$ insert into public.deals (name, stage, lost_reason) values ('x', 'lost', '   ') $$,
  '%deals_lost_needs_reason%',
  'lost with a blank lost_reason is rejected'
);
select lives_ok(
  $$ insert into public.deals (name, stage, lost_reason, next_action_at) values ('x', 'lost', 'price', null) $$,
  'lost with a lost_reason is accepted'
);

-- fee checks (amendment 3)
select throws_like(
  $$ insert into public.deals (name, stage, fee_period) values ('x', 'enrolled', 'yearly') $$,
  '%deals_fee_period_values%',
  'a fee_period other than monthly or quarterly is rejected'
);
select lives_ok(
  $$ insert into public.deals (name, stage, fee_period, fee_amount_paise) values ('x', 'enrolled', 'quarterly', 450000) $$,
  'quarterly with a positive fee is accepted'
);
select throws_like(
  $$ insert into public.deals (name, stage, fee_amount_paise) values ('x', 'enrolled', -1) $$,
  '%deals_fee_amount_paise_non_negative%',
  'a negative fee_amount_paise is rejected'
);

-- phone_e164 format (amendment 2)
select throws_like(
  $$ insert into public.contacts (first_name, phone_e164) values ('x', '+91 98765 43210') $$,
  '%contacts_phone_e164_format%',
  'a phone_e164 with spaces is rejected'
);
select throws_like(
  $$ insert into public.contacts (first_name, phone_e164) values ('x', '919876543210') $$,
  '%contacts_phone_e164_format%',
  'a phone_e164 without the leading + is rejected'
);

-- phone_e164 unique (partial index)
insert into public.contacts (first_name, phone_e164) values ('x', '+919800000001');
select throws_like(
  $$ insert into public.contacts (first_name, phone_e164) values ('y', '+919800000001') $$,
  '%contacts_phone_e164_key%',
  'a duplicate phone_e164 is rejected'
);
select lives_ok(
  $$ insert into public.contacts (first_name, phone_e164) values ('a', null), ('b', null) $$,
  'several parents without phone_e164 are accepted'
);
select lives_ok(
  $$ insert into public.contacts (first_name, phone_e164) values ('z', '+14155550123') $$,
  'a valid foreign E.164 number is accepted'
);
select is(
  (select whatsapp_opt_in from public.contacts where phone_e164 = '+14155550123'),
  true,
  'whatsapp_opt_in defaults to true'
);

select * from finish();
rollback;
