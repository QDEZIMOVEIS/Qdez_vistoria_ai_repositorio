
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Photo, Video } from "../types";

// Função auxiliar para extrair frames de uma string base64 de vídeo (simulada via amostragem de dados se necessário, 
// mas para o Gemini vamos focar em passar a intenção multimodal)
export const analyzeRoomWithAI = async (roomType: string, photos: Photo[], videos: Video[], notes?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const hasVideos = videos && videos.length > 0;

  const textPart = {
    text: `Você é um perito em vistorias imobiliárias profissional de alto nível da Qdez Imóveis. 
    Analise as imagens (e frames de vídeo se fornecidos) abaixo de um(a) ${roomType} e gere uma descrição técnica detalhada e formal.
    
    INSTRUÇÕES CRÍTICAS:
    1. Foque no estado de conservação: paredes, piso, teto, janelas, portas, guarnições e instalações.
    2. Identifique defeitos sutis: infiltrações, riscos no piso, estado da pintura (fosca/brilhante), funcionalidade aparente.
    3. Se houver vídeos, procure por detalhes de movimento: portas abrindo/fechando, teste de torneiras ou amplitude do espaço.
    4. Mantenha um tom pericial: use termos como "em perfeito estado", "apresenta desgaste natural", "marcas de uso", "pintura íntegra".
    5. Idioma: Português do Brasil.
    
    Notas do vistoriador no local: ${notes || 'Nenhuma nota adicional.'}`
  };

  // Preparamos as fotos (máximo 4 para não estourar limite de contexto em base64)
  const imageParts = photos.slice(0, 4).map(photo => ({
    inlineData: {
      data: photo.data.split(',')[1],
      mimeType: photo.mimeType
    }
  }));

  // Para vídeos, enviamos as thumbnails como "key frames" para a IA entender o contexto do vídeo
  const videoContextParts = videos.slice(0, 2).map(video => ({
    inlineData: {
      data: (video.thumbnail || video.data).split(',')[1],
      mimeType: 'image/jpeg'
    }
  }));

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { 
        parts: [textPart, ...imageParts, ...videoContextParts] 
      },
    });

    return response.text || "Não foi possível gerar a descrição automática.";
  } catch (error) {
    console.error("Erro ao analisar com Gemini:", error);
    return "Erro ao processar análise de IA multimodal. Verifique sua conexão.";
  }
};
