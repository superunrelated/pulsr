-- The Google Health API rejects any access token that also carries a
-- legacy Fitness API scope ("disallowed_scopes" error) — the two can't be
-- requested in one OAuth consent. Workouts/sleep (Health API) now need a
-- separate connection from steps/calories (legacy Fitness API).
alter table wearable_connections drop constraint wearable_connections_provider_check;
alter table wearable_connections add constraint wearable_connections_provider_check
  check (provider in ('google_fit', 'google_health'));
