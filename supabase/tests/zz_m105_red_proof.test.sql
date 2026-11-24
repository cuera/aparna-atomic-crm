-- THROWAWAY (M-105 proof): a deliberately failing assertion, reverted in the next commit.
-- It shows that a failing pgTAP test turns the Check e2e-test job red.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select is(1, 2, 'M-105 proof: this assertion fails on purpose');
select * from finish();
rollback;
