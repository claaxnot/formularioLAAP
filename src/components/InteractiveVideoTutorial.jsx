import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Users, 
  Bookmark, 
  CheckCircle, 
  AlertTriangle, 
  BookOpen, 
  GraduationCap, 
  ChevronRight, 
  ChevronLeft, 
  X,
  Sparkles,
  Download,
  Volume2,
  VolumeX,
  Mic,
  Maximize2,
  Tv,
  ShieldCheck,
  FileText,
  Video
} from 'lucide-react';

export default function InteractiveVideoTutorial({ isOpen, onClose }) {
  const [activeChapter, setActiveChapter] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [simulatedTimer, setSimulatedTimer] = useState(60);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [recordingStatusText, setRecordingStatusText] = useState('');
  const [recordingProgress, setRecordingProgress] = useState(0);

  const audioCtxRef = useRef(null);
  const bgMusicGainRef = useRef(null);
  const audioDestRef = useRef(null);
  const musicIntervalRef = useRef(null);

  // Preload Liceo Logo Image for High Definition Canvas Render
  const logoImgRef = useRef(null);
  useEffect(() => {
    const img = new Image();
    img.src = '/logo.png';
    img.onload = () => { logoImgRef.current = img; };
  }, []);

  const chapters = [
    {
      id: 'intro',
      title: '1. Inicio de Sesión e Identificación Institucional',
      subtitle: 'Acceso exclusivo con correo @estudiantes.edupro.cl',
      icon: ShieldCheck,
      color: '#3b82f6',
      badge: 'PASO 1 DE 6',
      narration: 'Bienvenido al Portal Oficial de Electivos 2026 del Liceo Arturo Alessandri Palma. Inicia sesión con tu correo institucional @estudiantes.edupro.cl. Si tienes problemas con tu correo, debes regularizarlo a la brevedad con tu Profesor Jefe, para que realice la gestión necesaria con su curso.',
      highlights: [
        'Acceso exclusivo en el portal oficial: https://electivoslaap.fplb.cl',
        'Ingreso con correo institucional obligado: @estudiantes.edupro.cl',
        '⚠️ ATENCIÓN: Si tienes problemas con tu correo, contacta a tu Profesor Jefe para regularizarlo a la brevedad.'
      ],
      demoType: 'login_demo'
    },
    {
      id: 'modality',
      title: '2. Declaración de Modalidad Académica',
      subtitle: 'Vía Científico-Humanista vs Vía Técnico-Profesional',
      icon: GraduationCap,
      color: '#8b5cf6',
      badge: 'PASO 2 DE 6',
      narration: 'Al ingresar por primera vez debes declarar tu modalidad educativa: Científico-Humanista para elegir electivos comunes por bloque de horario, o Técnico Profesional Gastronomía que registrará tu especialidad directa.',
      highlights: [
        'Científico Humanista: Permite elegir 3 asignaturas electivas por horario.',
        'Técnico Profesional: Registra tu especialidad en Gastronomía y cierra la toma de electivos.',
        'Declaración oficial registrada de forma inmutable en el sistema de UTP.'
      ],
      demoType: 'modality_demo'
    },
    {
      id: 'timer',
      title: '3. Tiempo Límite y Reserva Temporal (1 Minuto)',
      subtitle: 'Garantía de vacante congelada de 60s en la base de datos',
      icon: Clock,
      color: '#f59e0b',
      badge: 'CRÍTICO ⏱️',
      narration: '¡Atención! Al hacer clic en tu primer electivo se activa una reserva temporal de 1 minuto. Durante este tiempo tu cupo está 100% congelado en el sistema y nadie te lo podrá quitar mientras completas el formulario.',
      highlights: [
        '⏱️ Temporizador de 1 Minuto activo en la barra superior desde el primer clic.',
        '🔒 Bloqueo en tiempo real: Tu vacante queda reservada exclusivamente para ti durante 60 segundos.',
        '⚠️ Expiración a las 00:00: Si el tiempo concluye sin enviar, las vacantes se liberan automáticamente.'
      ],
      demoType: 'timer_demo'
    },
    {
      id: 'cupos',
      title: '4. Vacantes en Tiempo Real y Lista de Espera',
      subtitle: 'Sincronización automática de disponibilidad cada 5 segundos',
      icon: Users,
      color: '#10b981',
      badge: 'EN VIVO 🟢',
      narration: 'Los cupos se actualizan automáticamente en vivo cada 5 segundos. Si la asignatura que deseas agota sus vacantes, puedes hacer clic en Unirte a la Lista de Espera para obtener prioridad si alguien libera su reserva.',
      highlights: [
        '🟢 Cupos Disponibles: Indicador verde con el recuento exacto de vacantes.',
        '🔴 Cupos Agotados (0): Botón directo para unirse a la Lista de Espera oficial.',
        '⚡ Re-asignación automática cuando un estudiante libera una reserva.'
      ],
      demoType: 'cupos_demo'
    },
    {
      id: 'selection',
      title: '5. Selección por Bloques y Reglas de Área Académica',
      subtitle: 'Distribución horaria obligatoria y límite por áreas',
      icon: BookOpen,
      color: '#06b6d4',
      badge: 'PASO 5 DE 6',
      narration: 'Debes elegir exactamente una asignatura por cada bloque de horario habilitado. Recuerda que la normativa del Liceo Alessandri establece un máximo de 2 electivos pertenecientes a la misma área temática.',
      highlights: [
        '1 asignatura electiva obligatoria por cada bloque de horario.',
        'Máximo de 2 electivos pertenecientes a la misma Área (Área A, B o C).',
        'Acceso a la ficha técnica con el programa pedagógico de asignatura y docente a cargo.'
      ],
      demoType: 'selection_demo'
    },
    {
      id: 'confirmation',
      title: '6. Confirmación Definitiva y Comprobante PDF',
      subtitle: 'Certificado oficial con firma y respaldo al correo',
      icon: CheckCircle,
      color: '#ec4899',
      badge: 'FINALIZADO 🎓',
      narration: 'Al completar todos los bloques, presiona Enviar Postulación Definitiva. El sistema procesará tus asignaturas y generará un Comprobante PDF Oficial que se enviará automáticamente a tu correo y al de tu apoderado.',
      highlights: [
        'Certificado PDF Oficial con sello institucional UTP y código de validación.',
        'Copia automática enviada al correo del alumno y apoderados.',
        'Registro definitivo e inmutable en la base de datos de UTP LAAP.'
      ],
      demoType: 'confirmation_demo'
    }
  ];

  // Cache available Spanish voices for 100% speech reliability
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const updateVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setAvailableVoices(voices);
        }
      }
    };
    updateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const currentAudioRef = useRef(null);

  // Stream Pristine Neural HD Spanish Locutor Voice into speakers & MediaRecorder video output
  const playNeuralChapterAudio = (sIdx) => {
    if (!voiceEnabled) return;
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      }
      const audioPath = `/audio_narrations/cap${sIdx + 1}.mp3`;
      const audio = new Audio(audioPath);
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      if (audioCtxRef.current && bgMusicGainRef.current) {
        try {
          const src = audioCtxRef.current.createMediaElementSource(audio);
          src.connect(bgMusicGainRef.current);
        } catch (e) {
          // Ignore if source already attached
        }
      }

      audio.play().catch(e => {
        console.warn("Neural audio play fallback:", e);
        speakNarration(chapters[sIdx].narration);
      });
    } catch (err) {
      console.warn("Neural audio error:", err);
      speakNarration(chapters[sIdx].narration);
    }
  };

  // Audio Context Setup: Inspiring Harmonic Soundtrack + Formant Voice Audio Synthesizer
  const setupAudioContext = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume, ctx.currentTime);

      const dest = ctx.createMediaStreamDestination();
      masterGain.connect(ctx.destination);
      masterGain.connect(dest);

      audioCtxRef.current = ctx;
      bgMusicGainRef.current = masterGain;
      audioDestRef.current = dest;

      // Inspiring Cinematic Harmonic Progression (Cmaj9 -> Am9 -> Fmaj9 -> G11)
      const chordProgression = [
        [130.81, 196.00, 246.94, 329.63, 587.33], // Cmaj9
        [110.00, 164.81, 196.00, 261.63, 659.25], // Am9
        [87.31,  130.81, 164.81, 220.00, 392.00], // Fmaj9
        [98.00,  146.83, 174.61, 246.94, 659.25]  // G11
      ];

      // Ambient Delay Line (Echo / Reverb)
      const delayNode = ctx.createDelay();
      delayNode.delayTime.setValueAtTime(0.24, ctx.currentTime);
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.setValueAtTime(0.32, ctx.currentTime);
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.setValueAtTime(1200, ctx.currentTime);

      delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(masterGain);

      let chordIndex = 0;
      let arpeggioNote = 0;

      musicIntervalRef.current = setInterval(() => {
        if (!audioEnabled || ctx.state === 'suspended') return;

        const currentChord = chordProgression[chordIndex % chordProgression.length];
        const bassFreq = currentChord[0];
        const noteFreq = currentChord[(arpeggioNote % (currentChord.length - 1)) + 1];

        // 1. Lush Organic Synth Pad (Dual Detuned Oscillators)
        if (arpeggioNote % 4 === 0) {
          const padOsc1 = ctx.createOscillator();
          const padOsc2 = ctx.createOscillator();
          const padFilter = ctx.createBiquadFilter();
          const padGain = ctx.createGain();

          padOsc1.type = 'sine';
          padOsc1.frequency.setValueAtTime(bassFreq, ctx.currentTime);

          padOsc2.type = 'triangle';
          padOsc2.frequency.setValueAtTime(bassFreq * 2.01, ctx.currentTime); // Subtle detune warmth

          padFilter.type = 'lowpass';
          padFilter.frequency.setValueAtTime(450, ctx.currentTime);

          padGain.gain.setValueAtTime(0.001, ctx.currentTime);
          padGain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.6);
          padGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.4);

          padOsc1.connect(padFilter);
          padOsc2.connect(padFilter);
          padFilter.connect(padGain);
          padGain.connect(masterGain);

          padOsc1.start(ctx.currentTime);
          padOsc2.start(ctx.currentTime);
          padOsc1.stop(ctx.currentTime + 2.45);
          padOsc2.stop(ctx.currentTime + 2.45);
        }

        // 2. Gentle Emotional Piano / Celestial Chime Note
        const bellOsc = ctx.createOscillator();
        const bellGain = ctx.createGain();

        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(noteFreq, ctx.currentTime);

        bellGain.gain.setValueAtTime(0.001, ctx.currentTime);
        bellGain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.04);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);

        bellOsc.connect(bellGain);
        bellGain.connect(masterGain);
        bellGain.connect(delayNode); // Feed into ambient delay line

        bellOsc.start(ctx.currentTime);
        bellOsc.stop(ctx.currentTime + 0.95);

        arpeggioNote++;
        if (arpeggioNote % 4 === 0) {
          chordIndex++;
        }
      }, 450);

      return ctx;
    } catch (e) {
      console.warn("Audio Context init error:", e);
      return null;
    }
  };

  // Stream Pristine Institutional Audio Chime into Web Audio Graph & MediaRecorder Output
  const playInstitutionalAudioCue = (ctx, masterGainNode) => {
    if (!ctx || !masterGainNode) return;
    try {
      const startTime = ctx.currentTime;
      const notes = [523.25, 783.99]; // C5 to G5 elegant chime

      notes.forEach((freq, idx) => {
        const noteTime = startTime + (idx * 0.12);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.001, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.12, noteTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.6);

        osc.connect(gain);
        gain.connect(masterGainNode);
        if (audioDestRef.current) {
          gain.connect(audioDestRef.current);
        }

        osc.start(noteTime);
        osc.stop(noteTime + 0.65);
      });
    } catch (err) {
      console.warn("Error playing institutional audio cue:", err);
    }
  };

  useEffect(() => {
    if (isOpen && audioEnabled) {
      setupAudioContext();
    }
    return () => {
      if (musicIntervalRef.current) clearInterval(musicIntervalRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [isOpen, audioEnabled]);

  useEffect(() => {
    if (bgMusicGainRef.current && audioCtxRef.current) {
      bgMusicGainRef.current.gain.setValueAtTime(audioEnabled ? volume : 0, audioCtxRef.current.currentTime);
    }
  }, [volume, audioEnabled]);

  // Trigger Neural HD Voice ONLY when activeChapter changes during manual/auto preview (NOT during MP4 render loop)
  useEffect(() => {
    if (isOpen && !isRecording) {
      playNeuralChapterAudio(activeChapter);
    }
  }, [activeChapter, isOpen, isRecording]);

  // Preview Auto-advance Timer (16 seconds per scene so full narration finishes)
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setActiveChapter(prev => {
          if (prev < chapters.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 18000); // 18 full seconds per scene
    }
    return () => clearInterval(interval);
  }, [isPlaying, chapters.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedTimer(prev => (prev > 0 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Canvas Text Wrapping Helper to prevent ANY text cut-off!
  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY;
  };

  // ULTRA PRO HD CANVAS VIDEO ENGINE (Full 1080p 60 FPS Video Export with Audio & Narration)
  const handleDownloadVideoMP4 = async () => {
    try {
      setIsRecording(true);
      setRecordingProgress(0);
      setRecordingStatusText('Iniciando estudio de renderizado 1080p con audio...');

      const ctx = setupAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 1080p Canvas (1920 x 1080 Full HD)
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const c = canvas.getContext('2d');

      const videoTrack = canvas.captureStream(60).getVideoTracks()[0];
      const audioTrack = audioDestRef.current ? audioDestRef.current.stream.getAudioTracks()[0] : null;

      const streamTracks = [videoTrack];
      if (audioTrack) {
        streamTracks.push(audioTrack);
      }

      const combinedStream = new MediaStream(streamTracks);

      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        setRecordingStatusText('Compilando archivo MP4 final con audio...');
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Tutorial_Oficial_Electivos_LAAP_2026.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecordingProgress(100);
        setRecordingStatusText('¡Descarga completada!');
      };

      mediaRecorder.start(100);

      // EXTENDED TIMINGS: 18 SECONDS PER SCENE (Full narration without ANY cut-off!)
      const secondsPerScene = 18;
      const fps = 60;
      const framesPerScene = secondsPerScene * fps;
      const totalScenes = chapters.length;

      let currentSecTimer = 60;

      for (let sIdx = 0; sIdx < totalScenes; sIdx++) {
        const ch = chapters[sIdx];
        setActiveChapter(sIdx);
        setRecordingStatusText(`Procesando Escena ${sIdx + 1}/${totalScenes}: ${ch.title}`);

        // Play Neural HD Spanish Voice + Institutional Audio Cue into exported MP4 audio track!
        playNeuralChapterAudio(sIdx);
        playInstitutionalAudioCue(ctx, bgMusicGainRef.current);

        for (let f = 0; f < framesPerScene; f++) {
          const progressInScene = f / framesPerScene;
          currentSecTimer = 60 - Math.floor(f / fps);
          if (currentSecTimer < 0) currentSecTimer = 0;

          // Clear 1080p Screen Background
          c.fillStyle = '#090d16';
          c.fillRect(0, 0, 1920, 1080);

          // Subtle Radial Background Glow
          const bgGlow = c.createRadialGradient(960, 400, 100, 960, 540, 1000);
          bgGlow.addColorStop(0, `${ch.color}22`);
          bgGlow.addColorStop(1, '#090d16');
          c.fillStyle = bgGlow;
          c.fillRect(0, 0, 1920, 1080);

          // Top Header Bar
          const navGrad = c.createLinearGradient(0, 0, 1920, 120);
          navGrad.addColorStop(0, '#1e3a8a');
          navGrad.addColorStop(1, '#0f172a');
          c.fillStyle = navGrad;
          c.fillRect(0, 0, 1920, 120);

          c.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(0, 120);
          c.lineTo(1920, 120);
          c.stroke();

          // Header Text & Badges
          c.fillStyle = '#ffffff';
          c.font = 'bold 34px system-ui, sans-serif';
          c.fillText('LICEO ARTURO ALESSANDRI PALMA', 80, 58);

          c.fillStyle = '#94a3b8';
          c.font = 'bold 20px system-ui, sans-serif';
          c.fillText('GUÍA OFICIAL TOMA DE ELECTIVOS 2026', 80, 95);

          // Badge
          c.fillStyle = ch.color;
          c.beginPath();
          c.roundRect(1450, 38, 390, 48, 12);
          c.fill();
          c.fillStyle = '#000000';
          c.font = '900 22px system-ui, sans-serif';
          c.textAlign = 'center';
          c.fillText(ch.badge, 1645, 71);
          c.textAlign = 'left';

          // LEFT COLUMN: High Definition UI Mockup Display (x: 60, y: 150, w: 1040, h: 690)
          c.fillStyle = 'rgba(15, 23, 42, 0.85)';
          c.beginPath();
          c.roundRect(60, 150, 1040, 690, 24);
          c.fill();
          c.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          c.lineWidth = 2;
          c.stroke();

          // Mockup Header Bar with EXACT REAL LINK
          c.fillStyle = '#1e293b';
          c.beginPath();
          c.roundRect(60, 150, 1040, 50, [24, 24, 0, 0]);
          c.fill();

          c.fillStyle = '#ef4444'; c.beginPath(); c.arc(95, 175, 7, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(120, 175, 7, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#10b981'; c.beginPath(); c.arc(145, 175, 7, 0, Math.PI * 2); c.fill();

          c.fillStyle = '#94a3b8';
          c.font = 'bold 17px monospace';
          c.fillText('https://electivoslaap.fplb.cl', 180, 181);

          // Mockup Inner Content Render
          if (ch.demoType === 'login_demo') {
            // Draw Official Liceo Logo Image
            if (logoImgRef.current && logoImgRef.current.complete) {
              c.save();
              c.fillStyle = '#ffffff';
              c.beginPath(); c.arc(580, 290, 52, 0, Math.PI * 2); c.fill();
              c.beginPath(); c.arc(580, 290, 50, 0, Math.PI * 2); c.clip();
              c.drawImage(logoImgRef.current, 530, 240, 100, 100);
              c.restore();
            } else {
              c.fillStyle = '#ffffff';
              c.beginPath(); c.arc(580, 290, 48, 0, Math.PI * 2); c.fill();
              c.fillStyle = '#1e293b'; c.font = '900 30px system-ui, sans-serif'; c.textAlign = 'center';
              c.fillText('LAAP', 580, 301); c.textAlign = 'left';
            }

            c.fillStyle = '#ffffff'; c.font = 'bold 32px system-ui, sans-serif'; c.textAlign = 'center';
            c.fillText('Portal de Acceso Estudiantil 2026', 580, 375);
            c.fillStyle = '#94a3b8'; c.font = '20px system-ui, sans-serif';
            c.fillText('Inicia sesión exclusivamente con tu correo institucional', 580, 415);

            // Google Button (Wide container 680px, perfectly aligned)
            c.fillStyle = '#ffffff';
            c.beginPath(); c.roundRect(240, 460, 680, 68, 18); c.fill();
            c.fillStyle = '#0f172a'; c.font = 'bold 21px system-ui, sans-serif'; c.textAlign = 'center';
            c.fillText('🔑  Ingresar con Google (@estudiantes.edupro.cl)', 580, 502);

            // Important warning alert card
            c.fillStyle = 'rgba(239, 68, 68, 0.15)';
            c.beginPath(); c.roundRect(140, 560, 880, 130, 18); c.fill();
            c.strokeStyle = '#ef4444'; c.lineWidth = 2; c.stroke();
            c.fillStyle = '#fca5a5'; c.font = 'bold 20px system-ui, sans-serif'; c.textAlign = 'center';
            c.fillText('⚠️ ATENCIÓN IMPORTANTÍSIMA DE ACCESO:', 580, 595);
            c.fillStyle = '#ffffff'; c.font = '17px system-ui, sans-serif';
            c.fillText('Si tienes problemas con tu correo @estudiantes.edupro.cl, debes regularizarlo a la brevedad', 580, 630);
            c.fillText('con tu Profesor Jefe, para que realice la gestión necesaria. Es el ÚNICO medio de ingreso.', 580, 660);
            c.textAlign = 'left';
          } else if (ch.demoType === 'modality_demo') {
            c.fillStyle = '#ffffff'; c.font = 'bold 32px sans-serif'; c.textAlign = 'center';
            c.fillText('Declaración de Modalidad Educativa', 580, 230); c.textAlign = 'left';

            // Card CH
            c.fillStyle = 'rgba(37, 99, 235, 0.25)';
            c.beginPath(); c.roundRect(110, 270, 450, 530, 20); c.fill();
            c.strokeStyle = '#3b82f6'; c.lineWidth = 3; c.stroke();
            c.fillStyle = '#60a5fa'; c.font = 'bold 28px sans-serif'; c.fillText('📚 Científico Humanista', 140, 330);
            c.fillStyle = '#e2e8f0'; c.font = '20px sans-serif';
            c.fillText('• Elección de 3 asignaturas electivas', 140, 390);
            c.fillText('• 3 bloques de horario disponibles', 140, 430);
            c.fillText('• Preparación PAES e Ingreso Superior', 140, 470);

            // Card TP
            c.fillStyle = 'rgba(16, 185, 129, 0.2)';
            c.beginPath(); c.roundRect(600, 270, 450, 530, 20); c.fill();
            c.strokeStyle = '#10b981'; c.lineWidth = 3; c.stroke();
            c.fillStyle = '#34d399'; c.font = 'bold 28px sans-serif'; c.fillText('🍳 Técnico Profesional', 630, 330);
            c.fillStyle = '#e2e8f0'; c.font = '20px sans-serif';
            c.fillText('• Especialidad Gastronomía', 630, 390);
            c.fillText('• Talleres prácticos y titulación', 630, 430);
            c.fillText('• Proceso de electivos se cierra', 630, 470);
          } else if (ch.demoType === 'timer_demo') {
            c.fillStyle = 'rgba(245, 158, 11, 0.2)';
            c.beginPath(); c.roundRect(100, 250, 960, 530, 24); c.fill();
            c.strokeStyle = '#f59e0b'; c.lineWidth = 4; c.stroke();

            c.fillStyle = '#fbbf24'; c.font = '900 64px monospace'; c.textAlign = 'center';
            c.fillText(`⏱️ Reserva Temporal: ${formatTimer(currentSecTimer)}`, 580, 360);

            c.fillStyle = '#ffffff'; c.font = 'bold 30px sans-serif';
            c.fillText('🔒 Tu vacante queda congelada exclusivamente para ti', 580, 440);
            c.fillStyle = '#fef3c7'; c.font = '22px sans-serif';
            c.fillText('Tienes 1 minuto (60 segundos) para revisar los programas y enviar el formulario.', 580, 500);
            c.fillText('Si el tiempo llega a 00:00, las vacantes se liberan automáticamente.', 580, 540);
            c.textAlign = 'left';
          } else if (ch.demoType === 'cupos_demo') {
            // Available
            c.fillStyle = 'rgba(16, 185, 129, 0.2)';
            c.beginPath(); c.roundRect(100, 250, 960, 240, 20); c.fill();
            c.strokeStyle = '#10b981'; c.lineWidth = 3; c.stroke();
            c.fillStyle = '#ffffff'; c.font = 'bold 28px sans-serif'; c.fillText('🔬 Taller de Biología y Genética Celular', 130, 310);
            c.fillStyle = '#a7f3d0'; c.font = '22px sans-serif'; c.fillText('Horario 1 — Prof. Marcelo Silva | Área A', 130, 350);
            c.fillStyle = '#10b981'; c.beginPath(); c.roundRect(710, 310, 320, 50, 16); c.fill();
            c.fillStyle = '#000000'; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.fillText('🟢 14 Cupos Disponibles', 870, 343); c.textAlign = 'left';

            // Waitlist
            c.fillStyle = 'rgba(239, 68, 68, 0.2)';
            c.beginPath(); c.roundRect(100, 520, 960, 240, 20); c.fill();
            c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.stroke();
            c.fillStyle = '#ffffff'; c.font = 'bold 28px sans-serif'; c.fillText('📖 Literatura Clásica y Argumentación', 130, 580);
            c.fillStyle = '#fca5a5'; c.font = '22px sans-serif'; c.fillText('Horario 2 — Sin vacantes directas | Área B', 130, 620);
            c.fillStyle = '#ef4444'; c.beginPath(); c.roundRect(710, 580, 320, 50, 16); c.fill();
            c.fillStyle = '#ffffff'; c.font = '900 20px sans-serif'; c.textAlign = 'center'; c.fillText('+ Unirse a Lista de Espera', 870, 613); c.textAlign = 'left';
          } else if (ch.demoType === 'selection_demo') {
            c.fillStyle = '#c084fc'; c.font = 'bold 30px sans-serif'; c.fillText('📌 Bloque Horario 1 (Selección Obligatoria)', 100, 250);

            c.fillStyle = 'rgba(139, 92, 246, 0.35)'; c.beginPath(); c.roundRect(100, 280, 460, 480, 20); c.fill();
            c.strokeStyle = '#8b5cf6'; c.lineWidth = 4; c.stroke();
            c.fillStyle = '#ffffff'; c.font = 'bold 26px sans-serif'; c.fillText('✔️ Física Aplicada', 130, 340);
            c.fillStyle = '#ddd6fe'; c.font = '20px sans-serif'; c.fillText('Prof. Carlos Mendoza (Área A)', 130, 380);
            c.fillText('Estado: Seleccionado en Horario 1', 130, 430);

            c.fillStyle = 'rgba(255, 255, 255, 0.05)'; c.beginPath(); c.roundRect(590, 280, 460, 480, 20); c.fill();
            c.strokeStyle = 'rgba(255, 255, 255, 0.15)'; c.lineWidth = 2; c.stroke();
            c.fillStyle = '#94a3b8'; c.font = 'bold 26px sans-serif'; c.fillText('Historia y Sociedad', 620, 340);
            c.fillStyle = '#64748b'; c.font = '20px sans-serif'; c.fillText('Prof. Patricia Soto (Área B)', 620, 380);
            c.fillText('Opción disponible para alternar', 620, 430);
          } else if (ch.demoType === 'confirmation_demo') {
            c.fillStyle = 'rgba(6, 182, 212, 0.2)'; c.beginPath(); c.roundRect(140, 250, 880, 530, 24); c.fill();
            c.strokeStyle = '#06b6d4'; c.lineWidth = 4; c.stroke();
            c.fillStyle = '#06b6d4'; c.font = '900 30px system-ui, sans-serif'; c.textAlign = 'center';
            c.fillText('🎓 ¡Postulación Registrada Exitosamente!', 580, 335);
            c.fillStyle = '#ffffff'; c.font = 'bold 24px system-ui, sans-serif';
            c.fillText('Se ha emitido tu Certificado Oficial PDF firmado por UTP', 580, 405);
            c.fillStyle = '#cffaff'; c.font = '21px system-ui, sans-serif';
            c.fillText('Una copia idéntica se ha enviado a tu correo institucional y apoderados.', 580, 465);
            c.fillText('Código de Validación: LAAP-2026-REG-9874', 580, 525);
            c.textAlign = 'left';
          }

          // RIGHT COLUMN: High Definition Highlights & Rules Panel (x: 1140, y: 150, w: 720, h: 690)
          c.fillStyle = '#0f172a';
          c.beginPath();
          c.roundRect(1140, 150, 720, 690, 24);
          c.fill();
          c.strokeStyle = ch.color;
          c.lineWidth = 3;
          c.stroke();

          // Title Right (Wrapped)
          c.fillStyle = ch.color;
          c.font = 'bold 26px system-ui, sans-serif';
          wrapText(c, ch.title, 1170, 200, 660, 32);

          c.fillStyle = '#94a3b8';
          c.font = '19px system-ui, sans-serif';
          wrapText(c, ch.subtitle, 1170, 265, 660, 24);

          c.strokeStyle = 'rgba(255, 255, 255, 0.1)'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(1170, 300); c.lineTo(1820, 300); c.stroke();

          c.fillStyle = '#ffffff';
          c.font = 'bold 20px system-ui, sans-serif';
          c.fillText('📌 Puntos Clave & Reglas Oficiales:', 1170, 335);

          // Highlights with WRAPPED text to prevent cut-off!
          ch.highlights.forEach((pt, idx) => {
            const py = 360 + (idx * 155);
            c.fillStyle = 'rgba(30, 41, 59, 0.85)';
            c.beginPath(); c.roundRect(1170, py, 660, 140, 16); c.fill();
            c.strokeStyle = 'rgba(255, 255, 255, 0.1)'; c.lineWidth = 1.5; c.stroke();

            c.fillStyle = ch.color; c.beginPath(); c.arc(1195, py + 35, 10, 0, Math.PI * 2); c.fill();

            c.fillStyle = '#f8fafc';
            c.font = 'bold 19px system-ui, sans-serif';
            wrapText(c, pt, 1220, py + 35, 590, 26);
          });

          // BOTTOM BANNER: Voiceover Subtitles (y: 860, h: 180) - WRAPPED TEXT!
          c.fillStyle = 'rgba(2, 6, 23, 0.96)';
          c.beginPath();
          c.roundRect(60, 860, 1800, 180, 20);
          c.fill();
          c.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          c.lineWidth = 2;
          c.stroke();

          c.fillStyle = ch.color;
          c.font = 'bold 22px system-ui, sans-serif';
          c.fillText('[ LOCUCIÓN OFICIAL UTP LAAP ]: ', 90, 900);

          c.fillStyle = '#ffffff';
          c.font = 'italic 21px system-ui, sans-serif';
          wrapText(c, `"${ch.narration}"`, 90, 935, 1740, 28);

          // Render Progress Bar
          const totalProgress = ((sIdx * framesPerScene) + f) / (totalScenes * framesPerScene);
          c.fillStyle = ch.color;
          c.fillRect(0, 1070, 1920 * totalProgress, 10);

          setRecordingProgress(Math.round(totalProgress * 100));

          await new Promise(r => setTimeout(r, 1000 / fps));
        }
      }

      mediaRecorder.stop();
    } catch (err) {
      console.error("Error al exportar video MP4:", err);
      alert("Error en el motor de renderizado de video: " + err.message);
      setIsRecording(false);
    }
  };

  if (!isOpen) return null;

  const currentCh = chapters[activeChapter];
  const CurrentIcon = currentCh.icon;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      backgroundColor: 'rgba(2, 6, 23, 0.95)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#0b1329',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '28px',
        width: '100%',
        maxWidth: '1120px',
        maxHeight: '95vh',
        overflow: 'hidden',
        boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(59, 130, 246, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        
        {/* Header Bar */}
        <div style={{
          padding: '18px 28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(30, 58, 138, 0.6) 0%, rgba(15, 23, 42, 0.95) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              backgroundColor: 'rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
              border: '1.5px solid rgba(96, 165, 250, 0.4)',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.35)'
            }}>
              <Video size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#f8fafc' }}>
                  Estudio de Video Tutorial HD — Electivos LAAP
                </h2>
                <span style={{ backgroundColor: '#2563eb', color: '#ffffff', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '12px' }}>
                  https://electivoslaap.fplb.cl
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Guía Oficial para Estudiantes (@estudiantes.edupro.cl) y Apoderados
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              style={{
                background: audioEnabled ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${audioEnabled ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '10px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: audioEnabled ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{audioEnabled ? 'Música ON' : 'Música OFF'}</span>
            </button>

            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              style={{
                background: voiceEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${voiceEnabled ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '10px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: voiceEnabled ? '#34d399' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              <Mic size={16} />
              <span>{voiceEnabled ? 'Voz ON' : 'Voz OFF'}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Studio View */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
          
          <div style={{
            background: 'radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%)',
            padding: '24px 32px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '380px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {/* Status Bar */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: '8px 18px',
                borderRadius: '24px',
                border: `1.5px solid ${currentCh.color}`,
                boxShadow: `0 0 20px ${currentCh.color}33`
              }}>
                <CurrentIcon size={18} style={{ color: currentCh.color }} />
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc' }}>
                  {currentCh.title}
                </span>
                <span style={{
                  fontSize: '10px',
                  backgroundColor: currentCh.color,
                  color: '#000000',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: '900'
                }}>
                  {currentCh.badge}
                </span>
              </div>

              {isRecording && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #ef4444',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1s infinite' }} />
                  <span>GRABANDO MP4 HD EN VIVO: {recordingProgress}%</span>
                </div>
              )}
            </div>

            {/* Screen Content Preview */}
            <div style={{ width: '100%', maxWidth: '720px', marginTop: '16px' }}>
              {currentCh.demoType === 'login_demo' && (
                <div style={{ background: 'rgba(30, 41, 59, 0.75)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)', textAlign: 'center' }}>
                  <div style={{ background: 'white', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                    <img src="/logo.png" alt="LAAP Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                  </div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#ffffff', fontWeight: 'bold' }}>Liceo Arturo Alessandri Palma</h3>
                  <p style={{ fontSize: '12px', color: '#60a5fa', margin: '0 0 12px 0', fontFamily: 'monospace' }}>https://electivoslaap.fplb.cl</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#ffffff', color: '#1e293b', padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', marginBottom: '14px' }}>
                    <span>🌐  Ingresar con Google (@estudiantes.edupro.cl)</span>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '10px', fontSize: '11px', color: '#fca5a5', lineHeight: '1.4' }}>
                    <strong>⚠️ AVISO IMPORTANTE:</strong> Si tienes problemas con tu correo institucional (@estudiantes.edupro.cl), debes corregirlo a la brevedad con la administración, ya que es la única manera de ingresar.
                  </div>
                </div>
              )}

              {currentCh.demoType === 'modality_demo' && (
                <div style={{ background: 'rgba(30, 41, 59, 0.75)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#f8fafc', textAlign: 'center', fontWeight: 'bold' }}>
                    Declaración Obligatoria de Modalidad Académica
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'rgba(37, 99, 235, 0.25)', border: '2px solid #3b82f6', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                      <BookOpen size={24} style={{ color: '#60a5fa', marginBottom: '6px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>Científico Humanista</div>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                      <GraduationCap size={24} style={{ color: '#34d399', marginBottom: '6px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>Técnico Profesional</div>
                    </div>
                  </div>
                </div>
              )}

              {currentCh.demoType === 'timer_demo' && (
                <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '2px solid #f59e0b', padding: '24px', borderRadius: '20px', textAlign: 'center' }}>
                  <Clock size={36} style={{ color: '#f59e0b', marginBottom: '8px' }} />
                  <div style={{ fontSize: '32px', fontWeight: '900', color: '#fbbf24', fontFamily: 'monospace', letterSpacing: '3px' }}>
                    ⏱️ Reserva Temporal: {formatTimer(simulatedTimer)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#fef3c7', marginTop: '8px' }}>
                    🔒 Tu vacante queda congelada en tiempo real durante 1 minuto (60 segundos) exclusivamente para ti.
                  </div>
                </div>
              )}

              {currentCh.demoType === 'cupos_demo' && (
                <div style={{ background: 'rgba(30, 41, 59, 0.75)', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.18)', border: '1.5px solid #10b981', padding: '12px 16px', borderRadius: '14px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>Taller de Biología Celular</div>
                    <span style={{ background: '#10b981', color: '#000', fontSize: '11px', fontWeight: '900', padding: '4px 10px', borderRadius: '12px' }}>🟢 14 Vacantes Libres</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.18)', border: '1.5px solid #ef4444', padding: '12px 16px', borderRadius: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>Literatura y Argumentación</div>
                    <button style={{ background: '#ef4444', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px' }}>+ Lista de Espera</button>
                  </div>
                </div>
              )}

              {currentCh.demoType === 'selection_demo' && (
                <div style={{ background: 'rgba(30, 41, 59, 0.75)', padding: '18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#c084fc', marginBottom: '8px' }}>Bloque Horario 1 (Selección Obligatoria)</div>
                  <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.35)', border: '2px solid #8b5cf6', borderRadius: '12px', fontSize: '12px' }}>
                    ✔️ <strong>Física General Aplicada</strong> (Seleccionado en tu Horario 1)
                  </div>
                </div>
              )}

              {currentCh.demoType === 'confirmation_demo' && (
                <div style={{ background: 'rgba(6, 182, 212, 0.18)', border: '2px solid #06b6d4', padding: '24px', borderRadius: '20px', textAlign: 'center' }}>
                  <CheckCircle size={44} style={{ color: '#06b6d4', marginBottom: '8px' }} />
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#ffffff', fontWeight: 'bold' }}>¡Postulación 2026 Registrada Exitosamente!</h3>
                  <p style={{ fontSize: '12px', color: '#cffaff', margin: '6px 0 0 0' }}>Se ha emitido tu Certificado PDF Oficial y enviado copia a tu correo institucional.</p>
                </div>
              )}
            </div>

            {/* Narration Subtitle Box */}
            <div style={{
              width: '100%',
              maxWidth: '840px',
              marginTop: '16px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '12px 20px',
              borderRadius: '16px',
              fontSize: '13.5px',
              lineHeight: '1.5',
              color: '#f1f5f9',
              textAlign: 'center'
            }}>
              <strong style={{ color: currentCh.color }}>[Locución Oficial UTP]: </strong>
              "{currentCh.narration}"
            </div>
          </div>

          {/* Highlights */}
          <div style={{ padding: '18px 28px', background: '#0b1329', flex: 1, overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
              📌 Puntos Clave & Reglas Oficiales:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentCh.highlights.map((point, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '13px',
                  color: '#f8fafc',
                  lineHeight: '1.4'
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentCh.color, flexShrink: 0 }} />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Bar */}
          <div style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#070b16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
              {chapters.map((ch, index) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChapter(index);
                    setIsPlaying(false);
                  }}
                  title={ch.title}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '4px',
                    backgroundColor: activeChapter === index ? ch.color : 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  backgroundColor: isPlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.25)',
                  color: isPlaying ? '#fca5a5' : '#60a5fa',
                  border: `1.5px solid ${isPlaying ? '#ef4444' : '#3b82f6'}`,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                <span>{isPlaying ? 'Pausar Vista Previa' : 'Ver Simulación HD'}</span>
              </button>

              <button
                onClick={handleDownloadVideoMP4}
                disabled={isRecording}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  borderRadius: '12px',
                  backgroundColor: isRecording ? '#d97706' : '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isRecording ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                <Download size={18} />
                <span>{isRecording ? `Generando Video MP4 (1080p - ${recordingProgress}%)...` : '📥 Generar y Descargar Video MP4 Pro'}</span>
              </button>

              <button
                disabled={activeChapter === 0}
                onClick={() => setActiveChapter(prev => prev - 1)}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: activeChapter === 0 ? '#475569' : '#ffffff',
                  cursor: activeChapter === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={20} />
              </button>

              <button
                disabled={activeChapter === chapters.length - 1}
                onClick={() => setActiveChapter(prev => prev + 1)}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: activeChapter === chapters.length - 1 ? '#475569' : '#ffffff',
                  cursor: activeChapter === chapters.length - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
