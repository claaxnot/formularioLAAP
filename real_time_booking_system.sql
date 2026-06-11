-- ==========================================================================
-- ⚡ SISTEMA DE RESERVAS TRANSACCIONALES DE ELECTIVOS EN TIEMPO REAL
-- LICEO ARTURO ALESSANDRI PALMA (LAAP)
-- ==========================================================================
-- Instrucciones: Pega y ejecuta este script completo en el editor SQL de Supabase.

-- 1. CREACIÓN DE LA TABLA DE RESERVAS TEMPORALES
CREATE TABLE IF NOT EXISTS public.reservas_temporales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    electivo_id UUID REFERENCES public.electivos(id) ON DELETE CASCADE,
    horario_id UUID REFERENCES public.horarios(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_alumno_horario UNIQUE (alumno_id, horario_id)
);

-- Habilitar permisos seguros y restringidos para producción
GRANT SELECT ON TABLE public.reservas_temporales TO anon;

GRANT SELECT, INSERT, DELETE
ON TABLE public.reservas_temporales
TO authenticated;

GRANT ALL ON TABLE public.reservas_temporales
TO service_role;

-- 2. SEGURIDAD DE FILA (ROW LEVEL SECURITY)
ALTER TABLE public.reservas_temporales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de reservas para autenticados" ON public.reservas_temporales;
CREATE POLICY "Permitir lectura de reservas para autenticados"
ON public.reservas_temporales
FOR SELECT
TO authenticated
USING (true); -- Permitido leer para que todos los alumnos vean la ocupación en caliente

DROP POLICY IF EXISTS "Permitir insercion propia" ON public.reservas_temporales;
CREATE POLICY "Permitir insercion propia"
ON public.reservas_temporales
FOR INSERT
TO authenticated
WITH CHECK (
    alumno_id IN (
        SELECT id FROM public.alumnos 
        WHERE correo = auth.jwt()->>'email'
    )
);

DROP POLICY IF EXISTS "Permitir eliminacion propia" ON public.reservas_temporales;
CREATE POLICY "Permitir eliminacion propia"
ON public.reservas_temporales
FOR DELETE
TO authenticated
USING (
    alumno_id IN (
        SELECT id FROM public.alumnos 
        WHERE correo = auth.jwt()->>'email'
    )
);

-- Asegurar que alumnos tenga la columna ya_postulo para control de finalización definitiva
ALTER TABLE public.alumnos ADD COLUMN IF NOT EXISTS ya_postulo BOOLEAN DEFAULT FALSE;

-- Columnas opcionales para apoderados y estado de envío de comprobante por correo
ALTER TABLE public.alumnos ADD COLUMN IF NOT EXISTS correo_apoderado_1 TEXT;
ALTER TABLE public.alumnos ADD COLUMN IF NOT EXISTS correo_apoderado_2 TEXT;
ALTER TABLE public.alumnos ADD COLUMN IF NOT EXISTS estado_correo TEXT DEFAULT 'pendiente';

-- ==========================================================================
-- 3. FUNCIÓN RPC: reservar_electivo_temporal (TRANSACTIONAL SEAT BOOKING)
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.reservar_electivo_temporal(
    p_alumno_id UUID,
    p_electivo_id UUID,
    p_horario_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con privilegios elevados para garantizar integridad transaccional
AS $$
DECLARE
    v_ya_postulo BOOLEAN;
    v_cupos_maximos INT;
    v_cupos_ocupados INT;
    v_temp_reservas INT;
    v_nombre_electivo TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- A. LIMPIEZA EN CALIENTE (Self-Cleaning): Eliminar todas las reservas expiradas del sistema de inmediato
    DELETE FROM public.reservas_temporales WHERE expires_at < now();

    -- B. Validar si el alumno ya finalizó formalmente su postulación
    SELECT COALESCE(ya_postulo, false) INTO v_ya_postulo
    FROM public.alumnos
    WHERE id = p_alumno_id;
    
    IF v_ya_postulo = TRUE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ya has finalizado tu postulación y tu portal se encuentra sellado.');
    END IF;

    -- C. Bloquear fila del electivo en tabla base para evitar condiciones de carrera (Concurrency Safety)
    SELECT nombre, cupos_maximos INTO v_nombre_electivo, v_cupos_maximos
    FROM public.electivos
    WHERE id = p_electivo_id
    FOR UPDATE;

    IF v_nombre_electivo IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'El electivo seleccionado no existe en los registros.');
    END IF;

    -- D. Obtener cupos ocupados (postulaciones finales firmes)
    SELECT COALESCE(cupos_ocupados, 0) INTO v_cupos_ocupados
    FROM public.vista_electivos_cupos
    WHERE id = p_electivo_id;

    -- E. Contar reservas temporales activas vigentes para este electivo (excluyendo a este mismo alumno)
    SELECT COUNT(*)::INT INTO v_temp_reservas
    FROM public.reservas_temporales
    WHERE electivo_id = p_electivo_id 
      AND expires_at > now() 
      AND alumno_id != p_alumno_id;

    -- F. Validar disponibilidad real (Capacidad Máxima vs Postulaciones Firmes + Reservas Activas)
    IF (v_cupos_ocupados + v_temp_reservas) >= v_cupos_maximos THEN
        RETURN jsonb_build_object('success', false, 'message', format('Lo sentimos, la asignatura "%s" ya no tiene vacantes libres (incluyendo reservas temporales de otros alumnos).', v_nombre_electivo));
    END IF;

    -- G. Transacción Atómica:
    -- 1. Eliminar cualquier reserva temporal previa que el alumno tenga en este mismo horario
    DELETE FROM public.reservas_temporales
    WHERE alumno_id = p_alumno_id AND horario_id = p_horario_id;

    -- 2. Crear la nueva reserva temporal por 1 minuto
    v_expires_at := now() + interval '1 minute';
    
    INSERT INTO public.reservas_temporales (alumno_id, electivo_id, horario_id, expires_at)
    VALUES (p_alumno_id, p_electivo_id, p_horario_id, v_expires_at);

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Cupo retenido para "%s". Tienes 1 minuto para completar tu postulación.', v_nombre_electivo),
        'expires_at', v_expires_at,
        'electivo_nombre', v_nombre_electivo
    );
END;
$$;

-- ==========================================================================
-- 4. FUNCIÓN RPC: confirmar_postulacion_final (TRANSACTION-SAFE FINALIZE)
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.confirmar_postulacion_final(
    p_alumno_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ya_postulo BOOLEAN;
    v_nivel_destino TEXT;
    v_required_count INT;
    v_reserved_count INT;
BEGIN
    -- A. Limpieza previa de expiraciones
    DELETE FROM public.reservas_temporales WHERE expires_at < now();

    -- B. Validar si el alumno ya finalizó su proceso
    SELECT COALESCE(ya_postulo, false), curso_actual INTO v_ya_postulo, v_nivel_destino
    FROM public.alumnos
    WHERE id = p_alumno_id;

    IF v_ya_postulo = TRUE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tu postulación ya ha sido finalizada y confirmada previamente.');
    END IF;

    -- C. Determinar el nivel_destino (3M o 4M) basado en el curso actual del roster
    IF v_nivel_destino LIKE '%2%' OR v_nivel_destino LIKE '%segundo%' OR v_nivel_destino LIKE '%Segundo%' THEN
        v_nivel_destino := '3M';
    ELSIF v_nivel_destino LIKE '%3%' OR v_nivel_destino LIKE '%tercero%' OR v_nivel_destino LIKE '%Tercero%' THEN
        v_nivel_destino := '4M';
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'No se pudo determinar el nivel de destino escolar para tu curso actual.');
    END IF;

    -- D. Obtener el número de bloques de horario únicos requeridos para su nivel
    SELECT COUNT(DISTINCT horario_id)::INT INTO v_required_count
    FROM public.electivos
    WHERE nivel_destino = v_nivel_destino AND activo = true;

    -- E. Obtener el número de bloques de horario únicos vigentes que el alumno ha reservado
    SELECT COUNT(DISTINCT horario_id)::INT INTO v_reserved_count
    FROM public.reservas_temporales
    WHERE alumno_id = p_alumno_id AND expires_at > now();

    -- F. Validar completitud
    IF v_reserved_count < v_required_count THEN
        RETURN jsonb_build_object('success', false, 'message', format('Debes tener una reserva temporal activa para cada uno de los %s bloques de horario habilitados para tu nivel.', v_required_count));
    END IF;

    -- G. Conversión transaccional atómica:
    -- 1. Eliminar postulaciones previas
    DELETE FROM public.postulaciones WHERE alumno_id = p_alumno_id;

    -- 2. Migrar las reservas temporales activas a postulaciones finales
    INSERT INTO public.postulaciones (alumno_id, electivo_id, horario_id)
    SELECT alumno_id, electivo_id, horario_id
    FROM public.reservas_temporales
    WHERE alumno_id = p_alumno_id AND expires_at > now();

    -- 3. Limpiar las reservas temporales liberadas
    DELETE FROM public.reservas_temporales WHERE alumno_id = p_alumno_id;

    -- 4. Sellar la ficha del alumno de forma definitiva
    UPDATE public.alumnos SET ya_postulo = TRUE WHERE id = p_alumno_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Postulación confirmada y finalizada con éxito de forma definitiva.'
    );
END;
$$;

-- Explicitly grant RPC execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.reservar_electivo_temporal(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_postulacion_final(UUID) TO authenticated;
