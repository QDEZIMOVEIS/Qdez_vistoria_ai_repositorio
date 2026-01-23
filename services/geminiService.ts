
import { GoogleGenAI, Type } from "@google/genai";

const VISTORIADOR_SYSTEM_INSTRUCTION = `
Você é David Oliveira (Creci 84926-F), um Vistoriador Profissional de Imóveis especialista em laudos periciais.
Sua tarefa é REDIGIR descrições técnicas PRECISAS, DETALHADAS e OBJETIVAS para laudos de vistoria imobiliária.

REGRAS DE OURO:
- Use linguagem formal e técnica (ex: "piso em porcelanato acetinado", "pintura látex fosca", "esquadrias em alumínio anodizado").
- Foque estritamente no ESTADO DE CONSERVAÇÃO (novo, íntegro, avariado, com marcas de uso, com sujidade, etc).
- Não presuma causas de danos. Relate apenas o que é visualmente observável.
- Ao analisar fotos/vídeos, faça um inventário detalhado de todos os itens (portas, janelas, tomadas, interruptores, luminárias, móveis fixos).
- Diferencie o tom conforme o tipo de laudo:
  - ENTRADA: Registro minucioso do estado inicial para garantia das partes.
  - SAÍDA: Foco na comparação e desgaste/danos durante a locação.
  - CONSTATAÇÃO: Relato fiel da situação em um momento específico.
- Organize os itens em listas para facilitar a leitura técnica.
`;

export const analyzeRoomMediaAI = async (roomType: string, inspectionType: string, mediaItems: { data: string, mimeType: string }[]): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const hasVideo = mediaItems.some(item => item.mimeType.startsWith('video/'));
  const modelName = hasVideo ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';

  const parts = [
    { text: `Analise as mídias deste ambiente (${roomType}) para um Laudo de ${inspectionType}.
    
    TAREFAS:
    1. Gere uma descrição técnica detalhada do ambiente (pisos, paredes, tetos).
    2. Liste todos os itens identificados e descreva o estado de conservação de cada um de forma precisa.
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
        systemInstruction: VISTORIADOR_SYSTEM_INSTRUCTION,
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

export const performComparisonAI = async (entryPdf: string, exitPdf: string, manualObs?: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    AJA COMO PERITO: Compare os laudos de ENTRADA e SAÍDA anexados.
    IDENTIFIQUE DIVERGÊNCIAS de estado e danos.
    ${manualObs ? `CONSIDERE ESTAS OBSERVAÇÕES ADICIONAIS DO VISTORIADOR: "${manualObs}"` : ''}
    
    Use o Google Search para encontrar custos estimados de reparo ou troca no mercado atual para os danos encontrados.
    Gere um laudo pericial de divergências detalhado.
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

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        { text: "Transcreva este áudio de vistoria para um texto técnico formal e direto." },
        { inlineData: { data: base64Audio, mimeType: mimeType } }
      ]
    },
    config: { systemInstruction: VISTORIADOR_SYSTEM_INSTRUCTION }
  });
  return response.text || "";
};
