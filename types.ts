
export interface Photo {
  id: string;
  data: string; // base64
  mimeType: string;
  label?: string; // Tag para identificar o item (ex: "Parede Norte", "Piso Entrada")
}

export interface Video {
  id: string;
  data: string; // base64
  mimeType: string;
  thumbnail?: string;
  duration?: number;
  size?: number;
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

export interface AppSettings {
  detailLevel: 'Conciso' | 'Normal' | 'Muito Detalhado';
  defaultSeverity: 'Baixa' | 'Média' | 'Alta';
  tone: 'Técnico' | 'Formal' | 'Direto';
}

export interface Inspection {
  id: string;
  clientName: string; // Proprietário/Locador
  tenantName: string; // Locatário
  inspectorName: string; 
  type: 'Entrada' | 'Saída' | 'Constatação' | 'Comparação'; 
  address: string;
  date: string;
  rooms: Room[];
  status: 'draft' | 'completed';
  isSynced?: boolean;
  comparisonResult?: ComparisonResult;
}

export const COMMON_ROOMS = [
  "Sala de Estar", "Cozinha", "Dormitório", "Suíte", "Banheiro Social",
  "Varanda/Sacada", "Área de Serviço", "Garagem", "Escritório", "Lavabo",
  "Quintal", "Corredor"
];
