import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Camera, RefreshCw, AlertCircle } from 'lucide-react';

interface VideoNoteRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVideoNote: (videoNoteUri: string) => void;
}

export const VideoNoteRecorderModal: React.FC<VideoNoteRecorderModalProps> = ({
  isOpen,
  onClose,
  onSendVideoNote
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setSeconds(0);
      setIsRecording(false);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      timer = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= 60) {
            handleStopAndSend();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 480 },
            height: { ideal: 480 }
          },
          audio: true
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStreamActive(true);
      } else {
        fallbackToSimulatedCamera();
      }
    } catch (err: any) {
      console.warn('Real camera not available in this environment, using animated camera view:', err);
      fallbackToSimulatedCamera();
    }
  };

  const fallbackToSimulatedCamera = () => {
    setStreamActive(false);
    // Render animated camera graphics onto canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;
    const render = () => {
      tick++;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gradient circles to simulate camera motion
      const gradient = ctx.createRadialGradient(
        canvas.width / 2 + Math.sin(tick * 0.05) * 30,
        canvas.height / 2 + Math.cos(tick * 0.05) * 30,
        10,
        canvas.width / 2,
        canvas.height / 2,
        140
      );
      gradient.addColorStop(0, '#38bdf8');
      gradient.addColorStop(0.5, '#0284c7');
      gradient.addColorStop(1, '#0f172a');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 120, 0, Math.PI * 2);
      ctx.fill();

      // Draw stylized avatar silhouette
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 25, 32, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height / 2 + 55, 55, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(render);
    };
    render();
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  const handleStartRecording = () => {
    recordedChunksRef.current = [];
    setIsRecording(true);

    if (streamRef.current && window.MediaRecorder) {
      try {
        const recorder = new MediaRecorder(streamRef.current);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.start(200);
        mediaRecorderRef.current = recorder;
      } catch (e) {
        console.warn('MediaRecorder error:', e);
      }
    }
  };

  const handleStopAndSend = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setTimeout(() => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          onSendVideoNote(url);
          onClose();
        } else {
          sendFallbackVideoNote();
        }
      }, 300);
    } else {
      sendFallbackVideoNote();
    }
  };

  const sendFallbackVideoNote = () => {
    // Generate a sleek video note clip URI or sample Telegram video note
    const sampleVideoNoteUrl = 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-video-call-with-camera-42880-large.mp4';
    onSendVideoNote(sampleVideoNoteUrl);
    onClose();
  };

  if (!isOpen) return null;

  const progressPercent = (seconds / 60) * 100;
  const strokeDashoffset = 100 - progressPercent;

  return (
    <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="w-full max-w-sm flex items-center justify-between text-white pt-4">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition"
          title="Отмена"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10">
          <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="font-mono text-sm font-bold tracking-wider">
            {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')} / 1:00
          </span>
        </div>

        <button
          type="button"
          onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition"
          title="Сменить камеру"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Main Telegram Circle Viewport */}
      <div className="relative my-auto flex items-center justify-center">
        {/* SVG Circular Progress Ring */}
        <svg className="w-72 h-72 sm:w-80 sm:h-80 -rotate-90 pointer-events-none absolute">
          <circle
            cx="50%"
            cy="50%"
            r="47%"
            className="stroke-white/20 fill-none"
            strokeWidth="5"
          />
          {isRecording && (
            <circle
              cx="50%"
              cy="50%"
              r="47%"
              className="stroke-sky-400 fill-none transition-all duration-300"
              strokeWidth="6"
              strokeDasharray="295"
              strokeDashoffset={`${(1 - seconds / 60) * 295}`}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Circular Viewport */}
        <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden bg-zinc-950 border-4 border-sky-400/80 shadow-2xl relative flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'} ${facingMode === 'user' ? '-scale-x-100' : ''}`}
          />
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            className={`w-full h-full object-cover ${streamActive ? 'hidden' : 'block'}`}
          />

          {!isRecording && (
            <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center text-white pointer-events-none p-4 text-center">
              <Camera className="w-8 h-8 mb-2 text-sky-400" />
              <p className="text-xs font-semibold">Нажмите для начала записи кружочка</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-sm flex items-center justify-around pb-6">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-sm active:scale-95 transition"
        >
          Отмена
        </button>

        {!isRecording ? (
          <button
            type="button"
            onClick={handleStartRecording}
            className="w-18 h-18 rounded-full bg-red-500 hover:bg-red-600 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-red-500/40 transition ring-4 ring-white/20"
            title="Начать запись"
          >
            <div className="w-7 h-7 rounded-full bg-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopAndSend}
            className="w-18 h-18 rounded-full bg-[#2AABEE] hover:bg-sky-400 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-sky-500/40 transition ring-4 ring-white/20"
            title="Отправить кружочек"
          >
            <Send className="w-7 h-7 ml-0.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (isRecording) {
              handleStopAndSend();
            } else {
              handleStartRecording();
            }
          }}
          className="px-5 py-2.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 font-medium text-sm active:scale-95 transition"
        >
          {isRecording ? 'Готово' : 'Запись'}
        </button>
      </div>
    </div>
  );
};
