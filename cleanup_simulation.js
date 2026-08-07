import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

// Supabase config from .env.local
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vjvacelrycjykjkendbgl.supabase.co'; // Using a placeholder if env var fails, but we'll run it with dotenv
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your_key_here'; // It needs the actual anon key from .env.local or service role key

// We'll require dotenv to parse .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize RUT
const formatRUT = (rut) => {
  if (!rut) return '';
  let cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 2) return cleanRut;
  const dv = cleanRut.slice(-1);
  const number = cleanRut.slice(0, -1);
  return `${parseInt(number, 10).toLocaleString('es-CL')}-${dv}`;
};

async function simulateCleanup() {
  console.log("Iniciando simulación de limpieza...");
  
  // 1. Leer Excel
  const wb = xlsx.readFile('Listado_Definitivo_2y3_Medio.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const excelData = xlsx.utils.sheet_to_json(ws);
  
  const validRuts = new Set(
    excelData
      .map(row => row.Rut || row.rut || row.RUT)
      .filter(Boolean)
      .map(r => formatRUT(String(r)))
  );
  
  console.log(`Leídos ${excelData.length} alumnos del Excel.`);
  console.log(`RUTs únicos válidos en el archivo: ${validRuts.size}`);
  
  // 2. Obtener datos de Supabase
  console.log("Obteniendo datos de Supabase...");
  
  // Como la base de datos puede devolver paginado, iteramos si es necesario, pero probablemente sean menos de 1000
  const { data: alumnos, error: errAlumnos } = await supabase.from('alumnos').select('*');
  if (errAlumnos) throw errAlumnos;
  
  const { data: postulaciones, error: errPostulaciones } = await supabase.from('postulaciones').select('alumno_id');
  if (errPostulaciones) throw errPostulaciones;
  
  const { data: modalidades, error: errModalidades } = await supabase.from('elecciones_modalidad').select('alumno_id');
  if (errModalidades) throw errModalidades;
  
  const { data: esperas, error: errEsperas } = await supabase.from('lista_espera').select('alumno_id');
  if (errEsperas) throw errEsperas;
  
  // Sets rápidos de alumnos con interacciones
  const alumnosConPostulacion = new Set(postulaciones.map(p => p.alumno_id));
  const alumnosConModalidad = new Set(modalidades.map(m => m.alumno_id));
  const alumnosEnEspera = new Set(esperas.map(e => e.alumno_id));
  
  console.log(`Total alumnos en base de datos: ${alumnos.length}`);
  
  const deleteList = [];
  const skipList = [];
  
  // 3. Evaluar reglas
  for (const al of alumnos) {
    const formattedAlRut = formatRUT(al.rut);
    const inExcel = validRuts.has(formattedAlRut);
    
    if (!inExcel) {
      // El alumno es "basura" o "antiguo". Revisamos si tiene postulaciones
      const hasInteractions = alumnosConPostulacion.has(al.id) || alumnosConModalidad.has(al.id) || alumnosEnEspera.has(al.id);
      
      if (hasInteractions) {
        skipList.push({
          id: al.id,
          nombre: al.nombre_completo,
          rut: al.rut,
          curso: al.curso_actual,
          motivo: "Tiene formularios o postulaciones reales"
        });
      } else {
        deleteList.push({
          id: al.id,
          nombre: al.nombre_completo,
          rut: al.rut,
          curso: al.curso_actual
        });
      }
    }
  }
  
  // 4. Reporte
  console.log("\n================ REPORTE DE SIMULACIÓN ================");
  console.log(`Total alumnos a ELIMINAR (seguros): ${deleteList.length}`);
  console.log(`Total alumnos que NO ESTÁN en el Excel pero SE SALVAN por tener postulaciones: ${skipList.length}`);
  console.log(`Total alumnos que están en el Excel y SE MANTIENEN: ${alumnos.length - deleteList.length - skipList.length}`);
  console.log("========================================================\n");
  
  if (skipList.length > 0) {
    console.log("Alumnos salvados (ejemplos):");
    skipList.slice(0, 5).forEach(s => console.log(` - ${s.nombre} (${s.curso})`));
  }
  
  if (deleteList.length > 0) {
    console.log("\nAlumnos que serán eliminados (ejemplos):");
    deleteList.slice(0, 5).forEach(s => console.log(` - ${s.nombre} (${s.curso})`));
  }
  
  // Guardar reporte detallado
  fs.writeFileSync('reporte_simulacion.json', JSON.stringify({ deleteList, skipList }, null, 2));
  console.log("\nReporte completo guardado en 'reporte_simulacion.json'");
}

simulateCleanup().catch(console.error);
