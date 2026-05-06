-- Add site/location field to products
alter table dim_products
  add column if not exists location text;
