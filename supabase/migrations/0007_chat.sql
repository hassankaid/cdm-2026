-- =====================================================================
-- 0007 — Chat global (le vestiaire) + messages système
-- =====================================================================
create table chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid references profiles (id) on delete set null,
  content    text not null check (char_length(content) between 1 and 500),
  type       text not null default 'user',   -- 'user' | 'system'
  created_at timestamptz not null default now()
);
create index chat_messages_created_idx on chat_messages (created_at);

alter table chat_messages enable row level security;
create policy "chat readable" on chat_messages
  for select to authenticated using (true);
create policy "chat insert own" on chat_messages
  for insert to authenticated
  with check (auth.uid() = user_id and type = 'user');

-- Realtime
alter table chat_messages replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table chat_messages;
  exception when others then null;
  end;
end $$;
