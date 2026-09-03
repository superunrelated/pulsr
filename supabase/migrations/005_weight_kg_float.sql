-- Postgres `numeric` is returned by PostgREST as a string (to avoid precision
-- loss), which broke client-side arithmetic on weight_kg (string concat
-- instead of addition). double precision is returned as a real JS number.
alter table weight_logs alter column weight_kg type double precision;
alter table profiles alter column goal_weight_kg type double precision;
