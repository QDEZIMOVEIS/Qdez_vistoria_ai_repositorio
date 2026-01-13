
import React from 'react';
import { Video as VideoType } from '../types';

interface VideoUploaderProps {
  onVideosAdded: (newVideos: VideoType[]) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideosAdded }) => {
  const generateThumbnail = (file: File): Promise<{data: string, thumb: string}> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.muted = true;
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Pega o frame de 1 segundo
      };

      video.onseeked = () => {
        canvas.width = 320;
        canvas.height = 240;
        ctx?.drawImage(video, 0, 0, 320, 240);
        const thumb = canvas.toDataURL('image/jpeg', 0.5);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            data: e.target?.result as string,
            thumb: thumb
          });
        };
        reader.readAsDataURL(file);
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newVideos: VideoType[] = [];
    for (let i = 0; i < files.length; i++) {
      const { data, thumb } = await generateThumbnail(files[i]);
      newVideos.push({
        id: Math.random().toString(36).substr(2, 9),
        data: data,
        mimeType: files[i].type,
        thumbnail: thumb
      });
    }
    onVideosAdded(newVideos);
    e.target.value = '';
  };

  return (
    <div className="flex items-center justify-center w-full">
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-red-200 rounded-2xl cursor-pointer bg-red-50/30 hover:bg-red-50 transition-colors group">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className="w-8 h-8 mb-3 text-red-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z"/>
          </svg>
          <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Gravar Vídeo</p>
        </div>
        <input 
          type="file" 
          accept="video/*" 
          capture="environment"
          className="hidden" 
          onChange={handleFileChange} 
        />
      </label>
    </div>
  );
};

export default VideoUploader;
