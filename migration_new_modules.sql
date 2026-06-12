-- ============================================================
-- Akiter ERP — Migración módulos pendientes
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Líneas de detalle en facturas (como en presupuestos)
ALTER TABLE public.akiter_facturas
  ADD COLUMN IF NOT EXISTS lineas JSONB DEFAULT '[]'::jsonb;

-- 2. Tabla de cobros (pagos recibidos vinculados a facturas)
CREATE TABLE IF NOT EXISTS public.akiter_cobros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT,
  factura_id UUID REFERENCES public.akiter_facturas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.akiter_clientes(id) ON DELETE SET NULL,
  importe NUMERIC(12,2) NOT NULL,
  fecha_cobro DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pago TEXT DEFAULT 'transferencia'
    CHECK (forma_pago IN ('transferencia','efectivo','cheque','tarjeta','otro')),
  referencia TEXT,
  notas TEXT,
  created_by UUID REFERENCES public.akiter_usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_cobros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_cobros_all" ON public.akiter_cobros
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.akiter_usuarios u
      WHERE u.id = auth.uid() AND u.rol IN ('direccion','administrativo')
    )
  );
