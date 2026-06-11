-- =====================================================================
-- 0011 — Modération : chacun peut supprimer son propre message
-- =====================================================================
create policy "chat delete own" on chat_messages
  for delete to authenticated
  using (auth.uid() = user_id);
