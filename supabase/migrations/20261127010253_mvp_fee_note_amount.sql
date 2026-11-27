SET local check_function_bodies = off;

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
  paid_paise bigint;
begin
  -- Compare-and-set (M-109): only a caller who saw the current due date advances it.
  -- A concurrent second call waits on the row lock, re-checks next_fee_due and updates nothing.
  update public.deals
  set next_fee_due = (next_fee_due + case fee_period
    when 'monthly' then interval '1 month'
    when 'quarterly' then interval '3 months'
  end)::date
  where id = p_deal_id and next_fee_due = p_shown_due
  returning next_fee_due, fee_amount_paise into new_due, paid_paise;

  if not found then
    return false;
  end if;

  if new_due is null then
    raise exception 'Admission % has a next fee due date but no fee period', p_deal_id;
  end if;

  insert into public.deal_notes (deal_id, text)
  values (p_deal_id, format('Fee paid: %s, due %s, next due %s',
    coalesce('₹' || to_char(paid_paise / 100.0, 'FM999999999990.00'), 'amount not set'),
    p_shown_due, new_due));

  return true;
end;
$function$;
