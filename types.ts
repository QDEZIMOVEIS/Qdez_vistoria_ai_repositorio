
export interface Photo {
  id: string;
  data: string; // base64
  mimeType: string;
  label?: string; // Tag para identificar o item (ex: "Parede Norte", "Piso Entrada")
  name?: string;
  size?: number;
}

export interface Video {
  id: string;
  data: string; // base64
  mimeType: string;
  thumbnail?: string;
  duration?: number;
  size?: number;
}

export interface Audio {
  id: string;
  data: string; // base64
  mimeType: string;
  transcription?: string;
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
  audios?: Audio[];
  condition: 'Ótimo' | 'Bom' | 'Regular' | 'Ruim';
  aiAnalysis?: AIAnalysis;
  // Campos para Constatação de Reparos
  reparoDescricao?: string;
  reparoStatus?: 'Concluído' | 'Parcial' | 'Não Executado';
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

export interface Tenant {
  nome: string;
}

export interface Inspection {
  id: string;
  clientName: string; // Proprietário/Locador
  tenantName: string; // Mantido para compatibilidade (primeiro locatário)
  tenantNames?: string[]; // Lista de locatários para suporte a múltiplos
  inspectorName: string; 
  type: 'Entrada' | 'Saída' | 'Constatação' | 'Comparação'; 
  subtipoConstatacao?: 'Padrão' | 'Reparos';
  address: string;
  date: string;
  rooms: Room[];
  status: 'draft' | 'completed';
  isSynced?: boolean;
  comparisonResult?: ComparisonResult;
  observacoesGerais?: string;
}

export const COMMON_ROOMS = [
  "Sala de Estar", "Cozinha", "Dormitório", "Suíte", "Banheiro Social",
  "Varanda/Sacada", "Área de Serviço", "Garagem", "Escritório", "Lavabo",
  "Quintal", "Corredor"
];
