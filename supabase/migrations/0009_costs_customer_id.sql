alter table fact_costs
  add column if not exists customer_id bigint references dim_customers(id);
