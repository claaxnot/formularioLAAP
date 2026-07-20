import asyncio
import edge_tts
import os

narrations = [
    {
        "id": "cap1",
        "text": "Bienvenido al Portal Oficial de Electivos 2026 del Liceo Arturo Alessandri Palma. Inicia sesión con tu correo institucional @estudiantes.edupro.cl. Si tienes problemas con tu correo, debes regularizarlo a la brevedad con tu Profesor Jefe, para que realice la gestión necesaria."
    },
    {
        "id": "cap2",
        "text": "Al ingresar por primera vez debes declarar tu modalidad educativa: Científico-Humanista para elegir electivos comunes por bloque de horario, o Técnico Profesional Gastronomía que registrará tu especialidad directa."
    },
    {
        "id": "cap3",
        "text": "¡Atención! Al hacer clic en tu primer electivo se activa una reserva temporal de 1 minuto. Durante este tiempo tu cupo está 100% congelado en el sistema y nadie te lo podrá quitar mientras completas el formulario."
    },
    {
        "id": "cap4",
        "text": "Los cupos se actualizan automáticamente en vivo cada 5 segundos. Si la asignatura que deseas agota sus vacantes, puedes hacer clic en Unirte a la Lista de Espera para obtener prioridad si alguien libera su reserva."
    },
    {
        "id": "cap5",
        "text": "Debes elegir exactamente una asignatura por cada bloque de horario habilitado. Recuerda que la normativa del Liceo Alessandri establece un máximo de 2 electivos pertenecientes a la misma área temática."
    },
    {
        "id": "cap6",
        "text": "Al completar todos los bloques, presiona Enviar Postulación Definitiva. El sistema procesará tus asignaturas y generará un Comprobante PDF Oficial que se enviará automáticamente a tu correo y al de tu apoderado."
    }
]

async def generate_audio():
    output_dir = "public/audio_narrations"
    os.makedirs(output_dir, exist_ok=True)
    voice = "es-CL-CatalinaNeural"
    
    print(f"Generando locuciones con voz neural {voice}...")
    for item in narrations:
        out_path = os.path.join(output_dir, f"{item['id']}.mp3")
        communicate = edge_tts.Communicate(item['text'], voice, rate="+0%")
        await communicate.save(out_path)
        print(f"OK Generado: {out_path}")

if __name__ == "__main__":
    asyncio.run(generate_audio())
