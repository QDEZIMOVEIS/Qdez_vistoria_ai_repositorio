import React, { useRef, useState } from 'react';
import heic2any from 'heic2any';
import { Photo } from '../types';

interface PhotoUploaderProps {
  onPhotosAdded: (photos: Photo[]) => void;
  currentCount?: number;
  maxPhotos?: number;
}

const resizeImage = (file: File): Promise<string> =>
  new Promise((resolve) => {
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  onPhotosAdded,
  currentCount = 0,
  maxPhotos = 20,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFiles = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    const files = Array.from(filesList).filter((file) =>
      file.type.startsWith('image/') || 
      file.name.toLowerCase().endsWith('.heic') || 
      file.name.toLowerCase().endsWith('.heif')
    );

    if (files.length === 0) {
      alert('Selecione arquivos de imagem válidos.');
      return;
    }

    const availableSlots = maxPhotos - currentCount;

    if (availableSlots <= 0) {
      alert(`Este ambiente já atingiu o limite de ${maxPhotos} fotos.`);
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);

    if (files.length > availableSlots) {
      alert(
        `Somente ${availableSlots} foto(s) foram adicionadas. Limite por ambiente: ${maxPhotos}.`
      );
    }

    setIsLoading(true);

    try {
      const newPhotos: Photo[] = [];

      for (const file of selectedFiles) {
        let fileToProcess = file;

        // Converter HEIC/HEIF para JPEG se necessário
        if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
          try {
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.8
            });
            const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            fileToProcess = new File([resultBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
              type: 'image/jpeg'
            });
          } catch (err) {
            console.error('Erro ao converter HEIC:', err);
            continue; // Pula este arquivo se a conversão falhar
          }
        }

        const dataUrl = await resizeImage(fileToProcess);

        newPhotos.push({
          id: Math.random().toString(36).substr(2, 9),
          data: dataUrl,
          mimeType: 'image/jpeg',
          label: '',
          name: fileToProcess.name,
          size: fileToProcess.size,
        });
      }

      onPhotosAdded(newPhotos);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (error) {
      console.error('Erro ao carregar fotos:', error);
      alert('Não foi possível carregar uma ou mais fotos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Fotos do ambiente
          </p>
          <p className="text-[10px] font-bold text-slate-500">
            {currentCount}/{maxPhotos} fotos
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading || currentCount >= maxPhotos}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-50"
        >
          {isLoading ? 'Carregando...' : 'Selecionar Fotos'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="text-[9px] text-slate-400 font-bold">
        Você pode selecionar várias fotos de uma vez, até o limite de {maxPhotos} por ambiente.
      </div>
    </div>
  );
};

export default PhotoUploader;
