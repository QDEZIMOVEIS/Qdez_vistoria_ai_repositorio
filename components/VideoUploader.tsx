import React, { useState } from 'react';
import { Video as VideoType } from '../types';

interface VideoUploaderProps {
  onVideosAdded: (newVideos: VideoType[]) => void;
  videos?: VideoType[];
  onRemoveVideo?: (videoId: string) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideosAdded, videos = [], onRemoveVideo }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const processVideo = (file: File): Promise<VideoType> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        const reader = new FileReader();
        
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        };

        reader.onload = (e) => {
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            data: e.target?.result as string,
            mimeType: file.type,
            size: file.size,
            duration: video.duration
          });
        };
        reader.readAsDataURL(file);
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setProgress(0);
    const newVideos: VideoType[] = [];
    for (let i = 0; i < files.length; i++) {
      const v = await processVideo(files[i]);
      newVideos.push(v);
    }
    onVideosAdded(newVideos);
    setIsUploading(false);
    setProgress(0);
    e.target.value = '';
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-red-200 rounded-[2rem] cursor-pointer bg-red-50/10 hover:bg-red-50 transition-all group relative overflow-hidden">
          {isUploading ? (
            <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-10 p-4">
               <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[120px] mb-3">
                  <div 
                    className="bg-red-600 h-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
               </div>
               <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{progress}% Carregando</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Adicionar Vídeos</p>
              <p className="text-[8px] text-slate-400 mt-1 font-bold uppercase">(Galeria: mp4, webm, mov)</p>
            </div>
          )}
          <input 
            type="file" 
            multiple 
            accept="video/mp4,video/webm,video/quicktime,video/*" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </label>
      </div>

      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {videos.map((video) => (
            <div key={video.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="aspect-video bg-black relative group">
                <video 
                  src={video.data} 
                  className="w-full h-full object-contain" 
                  controls
                />
                {onRemoveVideo && (
                  <button
                    onClick={() => onRemoveVideo(video.id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="p-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Duração: {formatDuration(video.duration)}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tamanho: {formatSize(video.size)}</p>
                </div>
                <span className="text-[8px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase tracking-widest">Vídeo Salvo</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
