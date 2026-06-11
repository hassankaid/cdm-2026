-- =====================================================================
-- 0012 — Notification push à chaque message de chat (sauf l'auteur)
-- =====================================================================
create or replace function notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author  text;
  preview text;
  target  text;
begin
  -- on ne notifie que les vrais messages d'utilisateur
  if NEW.type <> 'user' then
    return NEW;
  end if;

  select display_name into author from profiles where id = NEW.user_id;
  author := coalesce(author, 'Quelqu''un');

  if NEW.media_type = 'video' then
    preview := '🎥 a envoyé un react';
  else
    preview := left(coalesce(NEW.content, ''), 140);
  end if;

  target := case
    when NEW.match_id is null then '/chat'
    else '/matchs/' || NEW.match_id || '/chat'
  end;

  perform net.http_post(
    url := 'https://nhtypfhuxprrxhadgsvk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', 'wc26-sync-7Hk2Pq9Z'
    ),
    body := jsonb_build_object(
      'title', author,
      'body', preview,
      'url', target,
      'exclude_user_id', NEW.user_id,
      'tag', 'chat-' || coalesce(NEW.match_id::text, 'global')
    )
  );

  return NEW;
end;
$$;

drop trigger if exists chat_message_notify on chat_messages;
create trigger chat_message_notify
  after insert on chat_messages
  for each row execute function notify_chat_message();
