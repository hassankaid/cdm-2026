-- =====================================================================
-- 0008 — Badges & palmarès
-- =====================================================================
create table badges (
  code          text primary key,
  label_fr      text not null,
  description_fr text,
  icon          text,
  category      text,
  rarity        text
);
alter table badges enable row level security;
create policy "badges readable" on badges for select to authenticated using (true);

create table user_badges (
  user_id    uuid references profiles (id) on delete cascade,
  badge_code text references badges (code) on delete cascade,
  earned_at  timestamptz not null default now(),
  context    jsonb,
  primary key (user_id, badge_code)
);
alter table user_badges enable row level security;
create policy "user_badges readable" on user_badges for select to authenticated using (true);

-- Catalogue
insert into badges (code, label_fr, description_fr, icon, category, rarity) values
  ('first_exact',   'Premier sang',   'Trouve ton 1er score exact',        '🎯', 'precision',  'commun'),
  ('sharp_shooter', 'Sniper',         '5 scores exacts',                   '🔫', 'precision',  'rare'),
  ('sniper',        'Tireur d''élite','10 scores exacts',                  '🏹', 'precision',  'epique'),
  ('streak_3',      'En forme',       '3 bons pronos d''affilée',          '🔥', 'serie',      'commun'),
  ('streak_5',      'En feu',         '5 bons pronos d''affilée',          '🌶️', 'serie',      'rare'),
  ('boss',          'Boss du jour',   'Termine meilleur d''une journée',   '👑', 'classement', 'rare'),
  ('clown',         'Clown du soir',  'Termine dernier d''une journée',    '🤡', 'fun',        'commun'),
  ('centurion',     'Centurion',      '100 points cumulés',                '💯', 'volume',     'epique'),
  ('predictor',     'Pilier',         '20 matchs pronostiqués',            '📊', 'volume',     'commun'),
  ('podium',        'Sur le podium',  'Atteins le top 3 du classement',    '🏆', 'classement', 'epique')
on conflict (code) do nothing;

-- Attribution automatique (idempotent)
create or replace function award_badges()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into user_badges (user_id, badge_code)
    select distinct user_id, 'first_exact' from predictions where base_points = 3
    on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select user_id, 'sharp_shooter' from predictions where base_points = 3 group by user_id having count(*) >= 5
    on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select user_id, 'sniper' from predictions where base_points = 3 group by user_id having count(*) >= 10
    on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select id, 'streak_3' from profiles where best_streak >= 3 on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select id, 'streak_5' from profiles where best_streak >= 5 on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select distinct user_id, 'boss' from daily_awards where kind = 'boss' and user_id is not null
    on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select distinct user_id, 'clown' from daily_awards where kind = 'clown' and user_id is not null
    on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select user_id, 'centurion' from predictions where points is not null group by user_id having coalesce(sum(points), 0) >= 100
    on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select user_id, 'predictor' from predictions where base_points is not null group by user_id having count(*) >= 20
    on conflict do nothing;
  insert into user_badges (user_id, badge_code)
    select user_id, 'podium' from (
      select user_id, row_number() over (order by total_official desc) as rn, total_official
      from leaderboard_live
    ) s where rn <= 3 and total_official > 0
    on conflict do nothing;
end;
$$;
