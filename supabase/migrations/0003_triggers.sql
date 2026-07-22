create or replace function audit_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_entity_id bigint;
begin
  v_org_id := coalesce(new.org_id, old.org_id);
  v_entity_id := coalesce(new.id, old.id);

  insert into activity_log (
    org_id,
    user_id,
    entity_type,
    entity_id,
    action,
    before_state,
    after_state
  )
  values (
    v_org_id,
    auth.uid(),
    tg_table_name,
    v_entity_id,
    lower(tg_op),
    to_jsonb(old),
    to_jsonb(new)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
  audit_tables text[] := array[
    'dim_statuses',
    'dim_payment_types',
    'dim_cost_categories',
    'dim_accounts',
    'dim_customers',
    'fact_leads',
    'fact_rough_leads',
    'fact_invoices',
    'fact_costs',
    'fact_income',
    'fact_cashflow',
    'fact_campaigns',
    'fact_campaign_updates',
    'ce_posts',
    'ce_settings',
    'notes',
    'custom_metrics',
    'accounting_manual_entries'
  ];
begin
  foreach t in array audit_tables loop
    execute format('drop trigger if exists trg_audit_%I on %I', t, t);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on %I for each row execute function audit_trigger()',
      t,
      t
    );
  end loop;
end $$;
