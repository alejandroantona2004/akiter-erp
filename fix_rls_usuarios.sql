-- Fix: drop the self-referencing RLS policy that causes profile load to fail
DROP POLICY IF EXISTS "akiter_usuarios_select" ON public.akiter_usuarios;

-- New policy: any authenticated user can read all profiles
-- (needed for ERP features like user dropdowns/assignments)
CREATE POLICY "akiter_usuarios_select" ON public.akiter_usuarios
  FOR SELECT USING (auth.uid() IS NOT NULL);