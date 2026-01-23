
import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings } from "../types";

const getSystemInstruction = (settings: AppSettings) => {
  let detailInstruction = "";
  if (settings.detailLevel === 'Conciso') {
    detailInstruction = "Seja extremamente breve e direto. Foque apenas no estado geral e danos críticos.";
  } else if (settings.detailLevel === 'Muito Detalhado') {
    detailInstruction = "Seja exaustivo. Descreva materiais, texturas, marcas aparentes de desgaste e faça um inventário minucioso de cada centímetro do ambiente.";
  }

  const severityInstruction = `Em caso de dúvidas sobre danos, classifique a gravidade como '${settings.defaultSeverity}' por padrão.`;
  const toneInstruction = `Use um tom predominantemente ${settings.tone}.`;

  return `
Você é David Oliveira (Creci 84926-F), um Vistoriador Profissional de Imóveis especialista em laudos periciais.
Sua tarefa é REDIGIR descrições técnicas PRECISAS para laudos de vistoria imobiliária.

ESTILO ESPECÍFICO:
- ${detailInstruction}
- ${severityInstruction}
- ${toneInstruction}

REGRAS GERAIS:
- Use linguagem profissional (ex: "piso em porcelanato acetinado", "pintura látex fosca").
- Foque estritamente no ESTADO DE CONSERVAÇÃO (novo, íntegro, avariado, com marcas de uso).
- Não presuma causas de danos. Relate apenas o que é visualmente observável.
- Organize os itens em listas para facilitar a leitura técnica.
`;
};

export const analyzeRoomMediaAI = async (
  roomType: string, 
  inspectionType: string, 
  mediaItems: { data: string, mimeType: string }[],
  settings: AppSettings
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const hasVideo = mediaItems.some(item => item.mimeType.startsWith('video/'));
  const modelName = hasVideo ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';

  const parts = [
    { text: `Analise as mídias deste ambiente (${roomType}) para um Laudo de ${inspectionType}.
    
    TAREFAS:
    1. Gere uma descrição técnica detalhada do ambiente.
    2. Liste todos os itens identificados e descreva o estado de conservação.
    3. Identifique evidências de danos ou falta de manutenção.
    
    Retorne os dados em formato JSON estruturado.` },
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
        systemInstruction: getSystemInstruction(settings),
        responseMimeType: "application/json",
        thinkingConfig: modelName === 'gemini-3-pro-preview' ? { thinkingBudget: 24576 } : undefined,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricaoGeral: { type: Type.STRING, description: "Descrição detalhada e técnica do ambiente." },
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
    console.error("Erro na análise técnica IA:", error);
    throw error;
  }
};

export const performComparisonAI = async (
  entryPdf: string, 
  exitPdf: string, 
  settings: AppSettings,
  manualObs?: string
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    AJA COMO PERITO: Compare os laudos de ENTRADA e SAÍDA anexados.
    IDENTIFIQUE DIVERGÊNCIAS de estado e danos.
    ${manualObs ? `CONSIDERE ESTAS OBSERVAÇÕES ADICIONAIS DO VISTORIADOR: "${manualObs}"` : ''}
    
    Use o Google Search para encontrar custos estimados de reparo no mercado atual.
    Gere um laudo pericial de divergências detalhado seguindo o estilo: Nível de Detalhe ${settings.detailLevel}, Tom ${settings.tone}.
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
        systemInstruction: getSystemInstruction(settings),
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });

    const analysis = response.text || "Falha na análise comparativa.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Referência Técnica",
        uri: chunk.web?.uri
      })).filter((s: any) => s.uri) || [];

    return { analysis, sources };
  } catch (error) {
    console.error("Erro na comparação pericial:", error);
    throw error;
  }
};

export const transcribeAudio = async (base64Audio: string, settings: AppSettings, mimeType: string = 'audio/webm'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        { text: `Transcreva este áudio de vistoria para um texto técnico formal. Siga o tom: ${settings.tone}.` },
        { inlineData: { data: base64Audio, mimeType: mimeType } }
      ]
    },
    config: { systemInstruction: getSystemInstruction(settings) }
  });
  return response.text || "";
};
