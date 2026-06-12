-- ============================================================
-- Akiter ERP — Supabase Schema (prefijo akiter_)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- Tabla de usuarios (extiende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT,
  apellidos TEXT,
  rol TEXT NOT NULL DEFAULT 'tecnico'
    CHECK (rol IN ('direccion','comercial','tecnico','administrativo','subcontratista')),
  avatar_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "akiter_usuarios_select" ON public.akiter_usuarios
  FOR SELECT USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol = 'direccion')
  );

CREATE POLICY "akiter_usuarios_insert" ON public.akiter_usuarios
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "akiter_usuarios_update" ON public.akiter_usuarios
  FOR UPDATE USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol = 'direccion')
  );

-- Trigger: crea perfil automáticamente al registrar usuario en auth.users
CREATE OR REPLACE FUNCTION public.akiter_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.akiter_usuarios (id, email, nombre, apellidos, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'apellidos',
    COALESCE(NEW.raw_user_meta_data->>'rol', 'tecnico')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS akiter_on_auth_user_created ON auth.users;
CREATE TRIGGER akiter_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.akiter_handle_new_user();

-- ============================================================
-- Clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cif TEXT,
  email TEXT,
  telefono TEXT,
  localidad TEXT,
  provincia TEXT,
  direccion TEXT,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','potencial')),
  notas TEXT,
  created_by UUID REFERENCES public.akiter_usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_clientes_all" ON public.akiter_clientes
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Proyectos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  cliente_id UUID REFERENCES public.akiter_clientes(id),
  responsable_id UUID REFERENCES public.akiter_usuarios(id),
  localidad TEXT,
  descripcion TEXT,
  estado TEXT DEFAULT 'planificacion'
    CHECK (estado IN ('planificacion','en_curso','pausado','finalizado','cancelado')),
  progreso INTEGER DEFAULT 0 CHECK (progreso BETWEEN 0 AND 100),
  presupuesto NUMERIC(12,2),
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_proyectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_proyectos_all" ON public.akiter_proyectos
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Presupuestos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES public.akiter_clientes(id),
  descripcion TEXT,
  base_imponible NUMERIC(12,2) DEFAULT 0,
  iva_porcentaje NUMERIC(5,2) DEFAULT 21,
  importe_iva NUMERIC(12,2) GENERATED ALWAYS AS (base_imponible * iva_porcentaje / 100) STORED,
  total NUMERIC(12,2) GENERATED ALWAYS AS (base_imponible * (1 + iva_porcentaje/100)) STORED,
  estado TEXT DEFAULT 'borrador'
    CHECK (estado IN ('borrador','enviado','aceptado','rechazado','expirado')),
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_validez DATE,
  notas TEXT,
  created_by UUID REFERENCES public.akiter_usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_presupuestos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_presupuestos_all" ON public.akiter_presupuestos
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Partes de Trabajo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_partes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  proyecto_id UUID REFERENCES public.akiter_proyectos(id),
  tecnico_id UUID REFERENCES public.akiter_usuarios(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  horas NUMERIC(4,1) DEFAULT 0,
  descripcion TEXT,
  estado TEXT DEFAULT 'borrador'
    CHECK (estado IN ('borrador','pendiente_firma','firmado','facturado')),
  firma_cliente TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_partes_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "akiter_partes_select" ON public.akiter_partes_trabajo
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','administrativo','comercial')) OR
    tecnico_id = auth.uid()
  );
CREATE POLICY "akiter_partes_insert" ON public.akiter_partes_trabajo
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "akiter_partes_update" ON public.akiter_partes_trabajo
  FOR UPDATE USING (
    tecnico_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','administrativo'))
  );

-- ============================================================
-- Facturas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES public.akiter_clientes(id),
  presupuesto_id UUID REFERENCES public.akiter_presupuestos(id),
  concepto TEXT,
  base_imponible NUMERIC(12,2) DEFAULT 0,
  iva_porcentaje NUMERIC(5,2) DEFAULT 21,
  total NUMERIC(12,2),
  estado TEXT DEFAULT 'borrador'
    CHECK (estado IN ('borrador','emitida','cobrada','vencida')),
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_facturas_all" ON public.akiter_facturas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','administrativo'))
  );

-- ============================================================
-- Proveedores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cif TEXT,
  categoria TEXT,
  contacto TEXT,
  email TEXT,
  telefono TEXT,
  localidad TEXT,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_proveedores_all" ON public.akiter_proveedores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','administrativo'))
  );

-- ============================================================
-- Inventario
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT,
  stock NUMERIC(10,2) DEFAULT 0,
  stock_minimo NUMERIC(10,2) DEFAULT 0,
  unidad TEXT DEFAULT 'ud',
  precio_unitario NUMERIC(10,2),
  ubicacion TEXT,
  proveedor_id UUID REFERENCES public.akiter_proveedores(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_inventario_select" ON public.akiter_inventario
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "akiter_inventario_write" ON public.akiter_inventario
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','administrativo'))
  );

-- ============================================================
-- Subvenciones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_subvenciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  organismo TEXT,
  cliente_id UUID REFERENCES public.akiter_clientes(id),
  importe NUMERIC(12,2),
  estado TEXT DEFAULT 'identificada'
    CHECK (estado IN ('identificada','solicitada','en_tramite','aprobada','denegada','cobrada')),
  fecha_solicitud DATE,
  fecha_resolucion DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_subvenciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_subvenciones_all" ON public.akiter_subvenciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','comercial'))
  );

-- ============================================================
-- Órdenes de Trabajo (subcontratistas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_ordenes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  proyecto_id UUID REFERENCES public.akiter_proyectos(id),
  subcontratista_id UUID REFERENCES public.akiter_usuarios(id),
  descripcion TEXT,
  localidad TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  horas_estimadas NUMERIC(6,1),
  estado TEXT DEFAULT 'asignada'
    CHECK (estado IN ('asignada','en_curso','completada','firmada')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_ordenes_trabajo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_ordenes_select" ON public.akiter_ordenes_trabajo
  FOR SELECT USING (
    subcontratista_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','tecnico'))
  );
CREATE POLICY "akiter_ordenes_write" ON public.akiter_ordenes_trabajo
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.akiter_usuarios u WHERE u.id = auth.uid() AND u.rol IN ('direccion','tecnico'))
  );

-- ============================================================
-- CRM — Leads / Oportunidades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.akiter_crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  empresa TEXT,
  email TEXT,
  telefono TEXT,
  etapa TEXT DEFAULT 'nuevo'
    CHECK (etapa IN ('nuevo','contactado','propuesta','negociacion','ganado','perdido')),
  valor NUMERIC(12,2) DEFAULT 0,
  asignado_id UUID REFERENCES public.akiter_usuarios(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.akiter_crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akiter_crm_all" ON public.akiter_crm_leads
  FOR ALL USING (auth.uid() IS NOT NULL);
