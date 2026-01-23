
import { GoogleGenAI, Type } from "@google/genai";

const VISTORIADOR_SYSTEM_INSTRUCTION = `
Você é David Oliveira (Creci 84926-F), um Vistoriador Profissional de Imóveis. 
Sua tarefa é REDIGIR descrições técnicas EXTREMAMENTE OBJETIVAS E RESUMIDAS.

REGRAS DE OURO:
- Seja direto. Evite textos longos e floreios.
- Use bullet points para listar itens identificados.
- Foque unicamente no ESTADO DE CONSERVAÇÃO (novo, íntegro, avariado, marcas de uso).
- Não presuma causas. Apenas relate o que é visível.
- Ao analisar fotos/vídeos, identifique os itens e dê um veredito rápido sobre o estado.
- Linguagem formal, porém enxuta.
`;

export const analyzeRoomMediaAI = async (roomType: string, mediaItems: { data: string, mimeType: string }[]): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const hasVideo = mediaItems.some(item => item.mimeType.startsWith('video/'));
  const modelName = hasVideo ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';

  const parts = [
    { text: `Analise este ambiente (${roomType}). 
    Gere um resumo executivo MUITO CURTO e liste os itens e seus estados.
    Foque apenas no estado de conservação.
    
    Retorne em JSON estruturado.` },
    ...mediaItems.map(item => ({
      inlineData: {
        data: item.data.split(',')[1] || item.data,
        mimeType: item.mimeType
      }
    }))
  ];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: VISTORIADOR_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        thinkingConfig: modelName === 'gemini-3-pro-preview' ? { thinkingBudget: 32768 } : undefined,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricaoGeral: { type: Type.STRING, description: "Resumo objetivo e curto do ambiente." },
            estadoConservacao: { type: Type.STRING, enum: ["Ótimo", "Bom", "Regular", "Ruim"] },
            itensIdentificados: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  estado: { type: Type.STRING },
                  detalhes: { type: Type.STRING }
                },
                required: ["item", "estado", "detalhes"]
              }
            },
            evidenciasDanos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestampOuLocal: { type: Type.STRING },
                  descricao: { type: Type.STRING },
                  gravidade: { type: Type.STRING, enum: ["Baixa", "Média", "Alta"] }
                }
              }
            }
          },
          required: ["descricaoGeral", "estadoConservacao", "itensIdentificados", "evidenciasDanos"]
        }
      }
    });

    const text = response.text;
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Erro na análise Gemini:", error);
    throw error;
  }
};

export const performComparisonAI = async (entryPdf: string, exitPdf: string, manualObs?: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Compare os dois laudos de vistoria (Entrada e Saída) em anexo.
    Aponte APENAS divergências de danos ou desgaste excessivo.
    ${manualObs ? `Considere também estas observações do vistoriador: "${manualObs}"` : ''}
    Use o Google Search para verificar preços médios de reparo/substituição para as divergências encontradas.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: entryPdf, mimeType: 'application/pdf' } },
          { inlineData: { data: exitPdf, mimeType: 'application/pdf' } }
        ]
      },
      config: {
        systemInstruction: VISTORIADOR_SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });

    const analysis = response.text || "Falha ao gerar análise pericial.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Fonte de Preço",
        uri: chunk.web?.uri
      })).filter((s: any) => s.uri) || [];

    return { analysis, sources };
  } catch (error) {
    console.error("Erro na comparação pericial:", error);
    throw error;
  }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        { text: "Transcreva este áudio para um laudo técnico de vistoria, seja muito objetivo." },
        { inlineData: { data: base64Audio, mimeType: mimeType } }
      ]
    },
    config: { systemInstruction: VISTORIADOR_SYSTEM_INSTRUCTION }
  });
  return response.text || "";
};

export const getPropertyContext = async (address: string, lat?: number, lng?: number): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `Localização: ${address}. Informe infraestrutura relevante próxima.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: lat && lng ? { latitude: lat, longitude: lng } : undefined
        }
      }
    }
  });
  return response.text || "";
};
