ALTER TABLE fact_costs ADD COLUMN IF NOT EXISTS apportion_to_customers boolean NOT NULL DEFAULT false;
