
import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings } from "../types";

const getSystemInstruction = (settings: AppSettings, context: 'analysis' | 'comparison' | 'image_edit' | 'repairs' = 'analysis') => {
  const detailInstruction = {
    'Conciso': "Seja extremamente breve e direto. Foque apenas no estado geral e danos críticos.",
    'Normal': "Descreva o estado de conservação de forma equilibrada e técnica.",
    'Muito Detalhado': "Seja exaustivo. Descreva materiais, texturas, marcas de uso e faça um inventário minucioso."
  }[settings.detailLevel];

  if (context === 'comparison') {
    return `Você é David Oliveira (Creci 84926-F), Perito Vistoriador da Qdez Imóveis.
Sua tarefa é COMPARAR dois laudos (Entrada e Saída) e identificar DIVERGÊNCIAS DOCUMENTAIS.
REGRAS:
- Linguagem formal, clara e objetiva.
- Registre apenas o que é OBSERVÁVEL.
- Identifique danos novos ou mudanças no estado de conservação.
- Apresente divergências, resumo do estado geral, pontos que pioraram, pontos críticos e recomendações.
- Incorpore as observações do vistoriador na conclusão.
- Use Google Search para estimar custos de reparo no mercado brasileiro.
- ${detailInstruction}`;
  }

  if (context === 'repairs') {
    return `Você é David Oliveira (Creci 84926-F), Vistoriador Profissional da Qdez Imóveis.
Sua tarefa é analisar a CONSTATAÇÃO DE REPAROS.
REGRAS:
- Descreva o reparo constatado de forma técnica e objetiva.
- Informe se o reparo foi concluído, parcial ou não executado com base nas evidências.
- Gere um texto técnico adequado para laudo de constatação.
- Se houver baixa confiança, escreva: "Necessita validação humana".`;
  }

  if (context === 'image_edit') {
    return `Você é um editor de imagens especializado em perícia imobiliária para a Qdez Imóveis. 
Sua tarefa é modificar a imagem conforme o comando do usuário para fins de documentação técnica. 
Mantenha o realismo e a precisão técnica. Se o usuário pedir para remover algo, use preenchimento generativo coerente.`;
  }

  return `Você é David Oliveira (Creci 84926-F), Vistoriador Profissional da Qdez Imóveis.
Sua tarefa é REDIGIR a descrição técnica de uma VISTORIA com linguagem FORMAL e OBJETIVA.
REGRAS:
- Escreva em português do Brasil, tom formal e impessoal.
- Use frases curtas. Não use adjetivos subjetivos.
- Não presuma causa. Descreva o fato.
- Informe material, cor, acabamento e estado.
- Descreva o cômodo em geral, itens identificados, estado de conservação e eventuais danos.
- NÃO invente dados. Se não tiver certeza: "Necessita validação humana".
- Para vídeos, inclua evidências com timestamp quando possível.
- ${detailInstruction}`;
};

/**
 * Edita uma imagem com base em um prompt de texto usando Gemini 2.5 Flash Image.
 */
export const editImageAI = async (
  imageData: string,
  prompt: string,
  settings: AppSettings
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash-image';

  // O payload deve ser limpo (apenas base64, sem o prefixo data:...)
  const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        systemInstruction: getSystemInstruction(settings, 'image_edit'),
        imageConfig: {
          aspectRatio: "4:3"
        }
      }
    });

    // O modelo retorna a imagem editada em um dos parts da resposta
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) throw new Error("Resposta da IA vazia.");

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/jpeg;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("O modelo não retornou uma imagem editada.");
  } catch (error) {
    console.error("Erro na edição de imagem IA:", error);
    throw error;
  }
};

export const analyzeRoomMediaAI = async (
  roomType: string, 
  inspectionType: string, 
  mediaItems: { data: string, mimeType: string }[],
  settings: AppSettings
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  const parts = [
    { text: `Analise as mídias deste ambiente (${roomType}) para um Laudo de ${inspectionType}. Retorne JSON.` },
    ...mediaItems.map(item => ({
      inlineData: {
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
                  local: { type: Type.STRING },
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

    return JSON.parse(response.text.replace(/```json/g, "").replace(/```/g, "").trim());
  } catch (error) {
    console.error("Erro análise IA:", error);
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
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `PERÍCIA COMPARATIVA:
Compare o Laudo de ENTRADA (PDF 1) com o Laudo de SAÍDA (PDF 2).
Identifique danos novos, itens faltantes ou desgaste excessivo.
${manualObs ? `FOCO ESPECÍFICO: "${manualObs}"` : ''}
Use Google Search para referenciar custos de reparo.
Retorne em Markdown técnico.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
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

    const analysis = response.text || "Erro na geração do parecer.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "Fonte de Custo",
        uri: chunk.web?.uri
      })).filter((s: any) => s.uri) || [];

    return { analysis, sources };
  } catch (error) {
    console.error("Erro Comparação:", error);
    throw error;
  }
};

export const transcribeAudio = async (base64Audio: string, settings: AppSettings, mimeType: string = 'audio/webm'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: `Transcreva este áudio de vistoria. Converta para linguagem técnica. Tom: ${settings.tone}.` },
          { inlineData: { data: base64Audio, mimeType: mimeType } }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    return "";
  }
};
