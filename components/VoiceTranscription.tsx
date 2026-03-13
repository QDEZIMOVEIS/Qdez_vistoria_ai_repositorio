
import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { AppSettings } from '../types';

interface VoiceTranscriptionProps {
  onTranscriptionComplete: (text: string, destination: 'general' | 'room' | 'comparison') => void;
  settings: AppSettings;
  mode?: 'general' | 'room' | 'comparison';
}

const VoiceTranscription: React.FC<VoiceTranscriptionProps> = ({ onTranscriptionComplete, settings, mode = 'room' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'general' | 'room' | 'comparison'>(mode);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        let mimeType = mediaRecorder.mimeType;
        if (!mimeType) {
          if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else mimeType = 'audio/webm';
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleTranscription(audioBlob, mimeType);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Permissão de microfone negada ou não disponível.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleTranscription = async (blob: Blob, rawMimeType: string) => {
    setIsProcessing(true);
    try {
      const base64 = await blobToBase64(blob);
      const mimeType = rawMimeType.split(';')[0] || 'audio/webm';
      const text = await transcribeAudio(base64, settings, mimeType);
      if (text) {
        onTranscriptionComplete(text, selectedMode);
      }
    } catch (err: any) {
      console.error("Erro na transcrição:", err);
      alert(err.message || "Não foi possível processar o áudio.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <div className="flex items-center gap-2">
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg active:scale-95 ${
                isProcessing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isProcessing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Processando...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  Gravar Áudio
                </>
              )}
            </button>
            
            {!isProcessing && (
              <select 
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-2 py-2 text-[8px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="room">Ambiente</option>
                <option value="general">Geral</option>
                <option value="comparison">Comparativo</option>
              </select>
            )}
          </div>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-lg animate-pulse"
          >
            <span className="w-2 h-2 bg-white rounded-full"></span>
            Parar Gravação
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceTranscription;
