-- Run this in Supabase SQL Editor to add line items support to presupuestos
ALTER TABLE public.akiter_presupuestos
  ADD COLUMN IF NOT EXISTS lineas JSONB DEFAULT '[]'::jsonb;
