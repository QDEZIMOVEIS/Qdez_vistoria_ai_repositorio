
import React from 'react';
import { Photo } from '../types';

interface PhotoUploaderProps {
  onPhotosAdded: (newPhotos: Photo[]) => void;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ onPhotosAdded }) => {
  const resizeImage = (file: File): Promise<Photo> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Redimensionar para no máximo 1200px de largura/altura para economizar espaço
          const MAX_SIZE = 1200;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Comprimir qualidade para 0.7 (70%)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            data: dataUrl,
            mimeType: 'image/jpeg',
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: Photo[] = [];
    for (let i = 0; i < files.length; i++) {
      const photo = await resizeImage(files[i]);
      newPhotos.push(photo);
    }
    onPhotosAdded(newPhotos);
    e.target.value = '';
  };

  return (
    <div className="flex items-center justify-center w-full">
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-white hover:bg-slate-50 transition-colors group">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className="w-8 h-8 mb-3 text-slate-400 group-hover:text-amber-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <p className="text-xs text-slate-500 font-black uppercase tracking-widest">Tirar Fotos</p>
        </div>
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          onChange={handleFileChange} 
        />
      </label>
    </div>
  );
};

export default PhotoUploader;
