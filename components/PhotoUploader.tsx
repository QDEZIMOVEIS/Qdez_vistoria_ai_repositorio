
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
    if (!files || files.length === 0) return;
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
      <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-[2rem] cursor-pointer bg-white hover:bg-slate-50 transition-all group shadow-sm active:scale-95">
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-red-50 transition-colors">
            <svg className="w-6 h-6 text-slate-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Fotos do Ambiente</p>
          <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold">(Múltiplas da Galeria)</p>
        </div>
        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
      </label>
    </div>
  );
};

export default PhotoUploader;
