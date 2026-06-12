-- ============================================================
-- Chat History — akiter_chats + akiter_chat_mensajes
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.akiter_chats (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES public.akiter_usuarios(id) ON DELETE CASCADE,
  titulo      TEXT        NOT NULL DEFAULT 'Nueva conversación',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "akiter_chats_own" ON public.akiter_chats
  FOR ALL USING (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS akiter_chats_usuario_updated
  ON public.akiter_chats(usuario_id, updated_at DESC);

-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.akiter_chat_mensajes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id       UUID        NOT NULL REFERENCES public.akiter_chats(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL CHECK (role IN ('user','assistant')),
  content       TEXT        NOT NULL DEFAULT '',
  image_preview TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_chat_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "akiter_chat_mensajes_own" ON public.akiter_chat_mensajes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.akiter_chats
      WHERE id = chat_id AND usuario_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS akiter_chat_mensajes_chat_created
  ON public.akiter_chat_mensajes(chat_id, created_at ASC);
