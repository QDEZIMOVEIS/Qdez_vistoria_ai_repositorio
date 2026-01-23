
import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings } from "../types";

const getSystemInstruction = (settings: AppSettings, context: 'analysis' | 'comparison' = 'analysis') => {
  const detailInstruction = {
    'Conciso': "Seja extremamente breve e direto. Foque apenas no estado geral e danos críticos.",
    'Normal': "Descreva o estado de conservação de forma equilibrada e técnica.",
    'Muito Detalhado': "Seja exaustivo. Descreva materiais, texturas, marcas de uso e faça um inventário minucioso."
  }[settings.detailLevel];

  const severityInstruction = `Em caso de dúvidas sobre danos, classifique a gravidade como '${settings.defaultSeverity}' por padrão.`;
  const toneInstruction = `Use um tom predominantemente ${settings.tone}.`;

  if (context === 'comparison') {
    return `Você é David Oliveira (Creci 84926-F), um Perito Vistoriador Imobiliário.
Sua tarefa é COMPARAR dois laudos (Entrada e Saída) e identificar DIVERGÊNCIAS.
- Foque em danos novos, itens faltantes ou mudanças no estado de conservação.
- Use o Google Search para encontrar preços reais de reparo no mercado brasileiro (estimados).
- Seja imparcial e estritamente técnico.
- ${detailInstruction}
- ${toneInstruction}`;
  }

  return `Você é David Oliveira (Creci 84926-F), um Vistoriador Profissional de Imóveis.
Sua tarefa é REDIGIR descrições técnicas PRECISAS para vistorias.
- Use linguagem técnica (ex: "pintura látex fosca", "esquadrias de alumínio").
- Relate apenas o que é visualmente observável.
- ${detailInstruction}
- ${severityInstruction}
- ${toneInstruction}`;
};

/**
 * Analisa mídias de um ambiente para gerar descrição técnica.
 */
export const analyzeRoomMediaAI = async (
  roomType: string, 
  inspectionType: string, 
  mediaItems: { data: string, mimeType: string }[],
  settings: AppSettings
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Modelos conforme diretrizes: Flash para velocidade/multimodal, Pro para complexidade
  const modelName = 'gemini-3-flash-preview';

  const parts = [
    { text: `Analise as mídias deste ambiente (${roomType}) para um Laudo de ${inspectionType}.
    
    TAREFAS:
    1. Gere uma descrição técnica detalhada seguindo as instruções de sistema.
    2. Liste itens e estados de conservação.
    3. Identifique evidências de danos.
    
    RETORNE EM JSON.` },
    ...mediaItems.map(item => ({
      inlineData: {
        // Garante que enviamos apenas a parte base64
        data: item.data.includes('base64,') ? item.data.split('base64,')[1] : item.data,
        mimeType: item.mimeType
      }
    }))
  ];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(settings, 'analysis'),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricaoGeral: { type: Type.STRING },
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
    if (!text) throw new Error("Resposta da IA vazia");
    
    return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  } catch (error) {
    console.error("Erro detalhado na análise IA:", error);
    throw error;
  }
};

/**
 * Realiza comparação pericial entre dois PDFs.
 */
export const performComparisonAI = async (
  entryPdf: string, 
  exitPdf: string, 
  settings: AppSettings,
  manualObs?: string
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prompt refinado para comparação documental
  const prompt = `AJA COMO PERITO: Compare o Laudo de ENTRADA (PDF 1) com o Laudo de SAÍDA (PDF 2).
  
DETERMINE AS DIVERGÊNCIAS:
1. Itens presentes na entrada que faltam na saída.
2. Danos novos (trincas, manchas, quebras) que não existiam no laudo de entrada.
3. Mudanças significativas no estado de conservação.

${manualObs ? `OBSERVAÇÕES DO VISTORIADOR PARA FOCO: "${manualObs}"` : ''}

IMPORTANTE: Use o Google Search para estimar custos de reparo/substituição para as divergências encontradas.
Apresente o resultado em Markdown profissional.`;

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
        systemInstruction: getSystemInstruction(settings, 'comparison'),
        tools: [{ googleSearch: {} }]
      }
    });

    const analysis = response.text || "Falha ao gerar texto da análise.";
    
    // Extração de fontes do Google Search
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Referência de Preço",
        uri: chunk.web?.uri
      })).filter((s: any) => s.uri) || [];

    return { analysis, sources };
  } catch (error) {
    console.error("Erro detalhado na comparação pericial:", error);
    throw error;
  }
};

/**
 * Transcreve áudio para texto técnico.
 */
export const transcribeAudio = async (base64Audio: string, settings: AppSettings, mimeType: string = 'audio/webm'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: `Transcreva este áudio de vistoria. Tom: ${settings.tone}. Converta gírias para termos técnicos imobiliários.` },
          { inlineData: { data: base64Audio, mimeType: mimeType } }
        ]
      },
      config: { systemInstruction: getSystemInstruction(settings, 'analysis') }
    });
    return response.text || "";
  } catch (error) {
    console.error("Erro na transcrição:", error);
    return "";
  }
};
