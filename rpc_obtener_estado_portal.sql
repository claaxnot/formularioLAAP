-- ==========================================================================
-- OPTIMIZACIÓN DE ALTA CARGA: RPC PARA OBTENER ESTADO DEL PORTAL EN 1 QUERY
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.obtener_estado_portal_estudiante(
    p_alumno_id UUID,
    p_nivel_destino TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_procesos JSONB;
    v_modalidad JSONB;
    v_postulaciones JSONB;
    v_reservas JSONB;
    v_lista_espera JSONB;
    v_cupos JSONB;
BEGIN
    -- 1. Procesos
    SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO v_procesos
    FROM (
        SELECT * FROM public.procesos 
        WHERE activo = true AND nivel_destino = p_nivel_destino
    ) p;

    -- 2. Modalidad (puede ser null)
    SELECT row_to_json(m)::jsonb INTO v_modalidad
    FROM public.elecciones_modalidad m
    WHERE alumno_id = p_alumno_id
    LIMIT 1;

    -- 3. Postulaciones (con join a electivos)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', po.id,
            'alumno_id', po.alumno_id,
            'electivo_id', po.electivo_id,
            'horario_id', po.horario_id,
            'created_at', po.created_at,
            'electivos', row_to_json(e)
        )
    ), '[]'::jsonb) INTO v_postulaciones
    FROM public.postulaciones po
    LEFT JOIN public.electivos e ON po.electivo_id = e.id
    WHERE po.alumno_id = p_alumno_id;

    -- 4. Reservas temporales vigentes
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_reservas
    FROM public.reservas_temporales r
    WHERE alumno_id = p_alumno_id AND expires_at > now();

    -- 5. Lista de espera (solo electivo_id)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('electivo_id', le.electivo_id)), '[]'::jsonb) INTO v_lista_espera
    FROM public.lista_espera le
    WHERE alumno_id = p_alumno_id;

    -- 6. Vista cupos electivos (todos)
    SELECT COALESCE(jsonb_agg(row_to_json(vc)), '[]'::jsonb) INTO v_cupos
    FROM public.vista_electivos_cupos vc;

    RETURN jsonb_build_object(
        'procesos', v_procesos,
        'modalidad', v_modalidad,
        'postulaciones', v_postulaciones,
        'reservas_temporales', v_reservas,
        'lista_espera', v_lista_espera,
        'electivos_cupos', v_cupos
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_estado_portal_estudiante(UUID, TEXT) TO authenticated;
