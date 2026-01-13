
export interface Photo {
  id: string;
  data: string; // base64
  mimeType: string;
}

export interface Video {
  id: string;
  data: string; // base64 ou blob URL
  mimeType: string;
  thumbnail?: string;
}

export interface Room {
  id: string;
  type: string;
  customName?: string;
  description: string;
  photos: Photo[];
  videos: Video[];
  condition: 'Novo' | 'Bom' | 'Regular' | 'Ruim';
}

export interface Inspection {
  id: string;
  clientName: string; 
  tenants: string[]; 
  ownerName?: string; 
  type: 'Entrada' | 'Saída' | 'Constatação'; 
  address: string;
  generalRemarks?: string;
  date: string;
  rooms: Room[];
  status: 'draft' | 'completed';
}

export const COMMON_ROOMS = [
  "Sala de Estar",
  "Cozinha",
  "Dormitório",
  "Suíte",
  "Banheiro Social",
  "Varanda/Sacada",
  "Área de Serviço",
  "Garagem",
  "Escritório",
  "Lavabo",
  "Quintal",
  "Corredor"
];
