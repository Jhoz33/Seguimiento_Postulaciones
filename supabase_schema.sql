-- ──────────────────────────────────────────────────────────────
-- Script SQL para Supabase - Tabla postulaciones
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ──────────────────────────────────────────────────────────────

CREATE TABLE postulaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Información básica
    nombre TEXT NOT NULL,
    enlace TEXT,
    
    -- Resultado + Fecha de Postulación
    resultado_postulacion TEXT DEFAULT 'Pendiente',
    fecha_postulacion DATE,
    
    -- Resultado + Fecha de Evaluación Técnica
    resultado_evaluacion TEXT DEFAULT 'Pendiente',
    fecha_evaluacion DATE,
    
    -- Resultado + Fecha de Evaluación Curricular
    resultado_cv TEXT DEFAULT 'Pendiente',
    fecha_cv DATE,
    
    -- Resultado + Fecha de Entrevista
    resultado_entrevista TEXT DEFAULT 'Pendiente',
    fecha_entrevista DATE,
    
    -- Resultado + Fecha Final
    resultado_final TEXT DEFAULT 'En proceso',
    fecha_final DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE postulaciones ENABLE ROW LEVEL SECURITY;

-- POLÍTICA: Cualquiera con el enlace puede leer)
CREATE POLICY "Lectura publica" ON postulaciones
    FOR SELECT USING (true);

-- POLÍTICA: Cualquiera con el enlace puede insertar
CREATE POLICY "Insercion publica" ON postulaciones
    FOR INSERT WITH CHECK (true);

-- POLÍTICA: Cualquiera con el enlace puede actualizar
CREATE POLICY "Actualizacion publica" ON postulaciones
    FOR UPDATE USING (true);

-- POLÍTICA: Cualquiera con el enlace puede eliminar
CREATE POLICY "Eliminacion publica" ON postulaciones
    FOR DELETE USING (true);

-- ──────────────────────────────────────────────────────────────
-- Notas:
-- 1. Si quieres restringir acceso solo a usuarios autenticados,
--    cambia `true` por `auth.role() = 'authenticated'` en las políticas.
-- 2. Para uso personal/público, las políticas actuales están bien.
-- ──────────────────────────────────────────────────────────────
