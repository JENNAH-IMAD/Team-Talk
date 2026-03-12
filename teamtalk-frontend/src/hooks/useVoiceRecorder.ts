import { useRef, useState } from 'react';

export function useVoiceRecorder(onAudioReady: (blob: Blob) => void) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onAudioReady(blob);
        stream.getTracks().forEach(t => t.stop());
        setDuration(0);
      };
      mr.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      // Microphone permission denied or not available
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current ?? 0);
    setRecording(false);
  };

  return { recording, duration, start, stop };
}
