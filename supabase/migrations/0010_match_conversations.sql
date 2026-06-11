-- =====================================================================
-- 0010 — Conversations par match + colonnes média (reacts vidéo)
-- =====================================================================

-- match_id : null = vestiaire général ; sinon = conversation de ce match
alter table chat_messages add column if not exists match_id   bigint references matches (id) on delete cascade;
-- Média (préparé pour les reacts vidéo Bunny, Phase B)
alter table chat_messages add column if not exists media_url     text;
alter table chat_messages add column if not exists media_type    text;  -- null | 'video'
alter table chat_messages add column if not exists thumbnail_url text;
alter table chat_messages add column if not exists duration      int;

create index if not exists chat_messages_match_idx on chat_messages (match_id, created_at);

-- Un message peut être du texte OU un média (contenu texte alors optionnel)
alter table chat_messages drop constraint if exists chat_messages_content_check;
alter table chat_messages alter column content drop not null;
alter table chat_messages add constraint chat_messages_content_or_media
  check (
    char_length(coalesce(content, '')) <= 500
    and (coalesce(content, '') <> '' or media_url is not null)
  );
