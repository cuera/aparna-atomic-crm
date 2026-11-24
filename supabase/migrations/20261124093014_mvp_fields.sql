SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."merge_contacts"(bigint, bigint) FROM "anon";

DROP VIEW "public"."contacts_summary";

ALTER TABLE "public"."contacts"
  ADD COLUMN "country" text;

ALTER TABLE "public"."contacts"
  ADD COLUMN "timezone" text DEFAULT 'Asia/Kolkata'::text;

ALTER TABLE "public"."contacts"
  ADD COLUMN "phone_e164" text;

ALTER TABLE "public"."contacts"
  ADD COLUMN "whatsapp_opt_in" boolean NOT NULL DEFAULT true;

ALTER TABLE "public"."deals"
  ADD COLUMN "child_name" text;

ALTER TABLE "public"."deals"
  ADD COLUMN "child_grade" text;

ALTER TABLE "public"."deals"
  ADD COLUMN "board" text;

ALTER TABLE "public"."deals"
  ADD COLUMN "course" text;

ALTER TABLE "public"."deals"
  ADD COLUMN "source" text;

ALTER TABLE "public"."deals"
  ADD COLUMN "next_action_at" timestamp WITH time zone DEFAULT (now() + '1 day'::interval);

ALTER TABLE "public"."deals"
  ADD COLUMN "lost_reason" text;

ALTER TABLE "public"."deals"
  ADD COLUMN "trial_at" timestamp WITH time zone;

ALTER TABLE "public"."deals"
  ADD COLUMN "first_response_at" timestamp WITH time zone;

ALTER TABLE "public"."deals"
  ADD COLUMN "enrolled_at" timestamp WITH time zone;

ALTER TABLE "public"."deals"
  ADD COLUMN "stage_changed_at" timestamp WITH time zone;

ALTER TABLE "public"."deals"
  ADD COLUMN "fee_amount_paise" bigint;

ALTER TABLE "public"."deals"
  ADD COLUMN "fee_period" text;

ALTER TABLE "public"."deals"
  ADD COLUMN "next_fee_due" date;

CREATE OR REPLACE FUNCTION public.enforce_mvp_two_staff_cap()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  active_count int;
begin
  -- Only a row that becomes active can exceed the cap (ADR-A14, M-108)
  if new.disabled or (tg_op = 'UPDATE' and not old.disabled) then
    return new;
  end if;

  -- Serialise concurrent invitations and re-enables, so two of them cannot both see a free slot
  perform pg_advisory_xact_lock(hashtext('sales_mvp_two_staff_cap'));

  -- SECURITY DEFINER: the count must see every row, whatever the caller's RLS
  select count(*) into active_count
  from public.sales
  where not disabled and id <> new.id;

  if active_count >= 2 then
    raise exception 'MVP allows two staff accounts (Owner and Counsellor); no Teacher accounts until role-based access (F-101) passes (ADR-A14)';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_deal_mvp_fields()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  -- The hidden deals.name follows the child's name (ADR-A12: one admission = one child)
  new.name := coalesce(nullif(btrim(new.child_name), ''), new.name);

  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'enrolled' then
      new.enrolled_at := now();
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_fee_paid (
  p_deal_id   bigint,
  p_shown_due date
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  new_due date;
begin
  -- Compare-and-set (M-109): only a caller who saw the current due date advances it.
  -- A concurrent second call waits on the row lock, re-checks next_fee_due and updates nothing.
  update public.deals
  set next_fee_due = (next_fee_due + case fee_period
    when 'monthly' then interval '1 month'
    when 'quarterly' then interval '3 months'
  end)::date
  where id = p_deal_id and next_fee_due = p_shown_due
  returning next_fee_due into new_due;

  if not found then
    return false;
  end if;

  if new_due is null then
    raise exception 'Admission % has a next fee due date but no fee period', p_deal_id;
  end if;

  insert into public.deal_notes (deal_id, text)
  values (p_deal_id, format('Fee paid: due %s, next due %s', p_shown_due, new_due));

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."mark_fee_paid"(bigint, date) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.merge_contacts (
  loser_id  bigint,
  winner_id bigint
)
  RETURNS bigint
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  deal_record RECORD;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign tasks from loser to winner
  UPDATE tasks SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 2. Reassign contact notes from loser to winner
  UPDATE contact_notes SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Update deals - replace loser with winner in contact_ids array
  FOR deal_record IN
    SELECT id, contact_ids
    FROM deals
    WHERE contact_ids @> ARRAY[loser_id]
  LOOP
    UPDATE deals
    SET contact_ids = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          array_remove(deal_record.contact_ids, loser_id) || ARRAY[winner_id]
        )
      )
    )
    WHERE id = deal_record.id;
  END LOOP;

  -- 4. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  -- Build a map of email -> email object, then convert back to array
  email_map := '{}'::jsonb;

  -- Add winner emails to map
  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  -- Add loser emails to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  -- Merge phones with deduplication by number
  phone_map := '{}'::jsonb;

  -- Add winner phones to map
  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  -- Add loser phones to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- Free the loser's phone_e164 first, or the partial unique index rejects the winner's update
  UPDATE contacts SET phone_e164 = NULL WHERE id = loser_id;

  -- 5. Update winner with merged data
  UPDATE contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    company_id = COALESCE(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = COALESCE(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    sales_id = COALESCE(winner_contact.sales_id, loser_contact.sales_id),
    tags = merged_tags,
    country = COALESCE(winner_contact.country, loser_contact.country),
    timezone = COALESCE(winner_contact.timezone, loser_contact.timezone),
    phone_e164 = COALESCE(winner_contact.phone_e164, loser_contact.phone_e164),
    -- An opt-out on either side survives the merge
    whatsapp_opt_in = winner_contact.whatsapp_opt_in AND loser_contact.whatsapp_opt_in
  WHERE id = winner_id;

  -- 6. Delete loser contact
  DELETE FROM contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$function$;

ALTER TABLE "public"."contacts"
  ADD CONSTRAINT "contacts_phone_e164_format" CHECK ((phone_e164 ~ '^\+[1-9][0-9]{6,14}$'::text));

ALTER TABLE "public"."deals"
  ADD CONSTRAINT "deals_fee_amount_paise_non_negative" CHECK ((fee_amount_paise >= 0));

ALTER TABLE "public"."deals"
  ADD CONSTRAINT "deals_fee_period_values" CHECK ((fee_period = ANY (ARRAY['monthly'::text, 'quarterly'::text])));

ALTER TABLE "public"."deals"
  ADD CONSTRAINT "deals_lost_needs_reason" CHECK (((stage <> 'lost'::text) OR (NULLIF(btrim(lost_reason), ''::text) IS NOT NULL)));

ALTER TABLE "public"."deals"
  ADD CONSTRAINT "deals_open_needs_next_action" CHECK (((stage = ANY (ARRAY['enrolled'::text, 'lost'::text])) OR (next_action_at IS NOT NULL)));

CREATE VIEW "public"."contacts_summary" WITH (security_invoker=on) AS  SELECT co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    co.country,
    co.timezone,
    co.phone_e164,
    co.whatsapp_opt_in,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath))::text AS email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath))::text AS phone_fts,
    c.name AS company_name,
    count(DISTINCT t.id) FILTER (WHERE (t.done_date IS NULL)) AS nb_tasks
   FROM ((public.contacts co
     LEFT JOIN public.tasks t ON ((co.id = t.contact_id)))
     LEFT JOIN public.companies c ON ((co.company_id = c.id)))
  GROUP BY co.id, c.name;

CREATE UNIQUE INDEX contacts_phone_e164_key ON public.contacts USING btree (phone_e164)
  WHERE (phone_e164 IS NOT NULL);

CREATE TRIGGER deals_mvp_fields
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_deal_mvp_fields();

CREATE TRIGGER sales_mvp_two_staff_cap
  BEFORE INSERT OR UPDATE OF disabled ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_mvp_two_staff_cap();

-- Grants (adjusted by hand from the pg-delta output, see the PR): the diff also emitted
-- DROP EXTENSION pg_net/pgjwt, postgres REVOKE/GRANT pairs and anon/authenticated EXECUTE on
-- get_user_id_by_email; those came from the throwaway declarative instance, not from this change.
GRANT ALL ON FUNCTION "public"."enforce_mvp_two_staff_cap"() TO "anon", "authenticated", "service_role";

GRANT ALL ON FUNCTION "public"."handle_deal_mvp_fields"() TO "anon", "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."mark_fee_paid"(bigint, date) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "public"."merge_contacts"(bigint, bigint) FROM PUBLIC;

GRANT ALL ON TABLE "public"."contacts_summary" TO "anon", "authenticated", "service_role";
