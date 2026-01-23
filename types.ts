
export interface Photo {
  id: string;
  data: string; // base64
  mimeType: string;
}

export interface Video {
  id: string;
  data: string; // base64
  mimeType: string;
  thumbnail?: string;
  duration?: number;
  size?: number;
  processed?: boolean;
}

export interface AIAnalysis {
  itens: any;
  evidencias: Array<{
    timestampInicio: string;
    descricao: string;
    gravidade: string;
  }>;
}

export interface Room {
  id: string;
  type: string;
  customName?: string;
  description: string;
  photos: Photo[];
  videos: Video[];
  condition: 'Ótimo' | 'Bom' | 'Regular' | 'Ruim';
  aiAnalysis?: AIAnalysis;
}

export interface BudgetLink {
  title: string;
  uri: string;
}

export interface ComparisonResult {
  analysis: string;
  budget: string;
  sources: BudgetLink[];
  manualObservations?: string;
}

export interface Inspection {
  id: string;
  clientName: string; // Proprietário
  tenantName: string; // Locatário / Interessado
  inspectorName: string; // Responsável pela Vistoria
  type: 'Entrada' | 'Saída' | 'Constatação' | 'Comparação'; 
  address: string;
  date: string;
  rooms: Room[];
  status: 'draft' | 'completed';
  comparisonResult?: ComparisonResult;
  shareToken?: string;
}

export const COMMON_ROOMS = [
  "Sala de Estar", "Cozinha", "Dormitório", "Suíte", "Banheiro Social",
  "Varanda/Sacada", "Área de Serviço", "Garagem", "Escritório", "Lavabo",
  "Quintal", "Corredor"
];
