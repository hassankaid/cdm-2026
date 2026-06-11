-- =====================================================================
-- 0004 — Préférences de notifications + idempotence
-- =====================================================================

create table notification_prefs (
  user_id        uuid primary key references profiles (id) on delete cascade,
  goals          boolean not null default true,   -- buts
  cards          boolean not null default false,  -- cartons
  kickoff        boolean not null default true,   -- coups d'envoi
  lock_reminder  boolean not null default true,   -- rappel avant verrouillage
  final_result   boolean not null default true,   -- résultat final + points
  daily_recap    boolean not null default true,   -- résumé du jour
  roast          boolean not null default true,   -- notifs "charrie" / boss du jour
  only_my_preds  boolean not null default false,  -- ne notifier que mes matchs pronostiqués
  created_at     timestamptz not null default now()
);
alter table notification_prefs enable row level security;
create policy "own prefs read"   on notification_prefs for select to authenticated using (auth.uid() = user_id);
create policy "own prefs insert" on notification_prefs for insert to authenticated with check (auth.uid() = user_id);
create policy "own prefs update" on notification_prefs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Idempotence : éviter d'envoyer deux fois la même notif (clé d'événement unique)
create table notifications_log (
  id         bigint generated always as identity primary key,
  event_key  text unique not null,
  kind       text,
  title      text,
  body       text,
  created_at timestamptz not null default now()
);
alter table notifications_log enable row level security; -- service_role uniquement
