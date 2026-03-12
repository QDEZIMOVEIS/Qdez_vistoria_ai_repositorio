import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings } from "../types";

const stripDataUrl = (value: string) => {
  if (!value) return "";
  return value.includes(",") ? value.split(",")[1] : value;
};

const estimateBase64SizeMB = (value: string) => {
  const clean = stripDataUrl(value);
  return (clean.length * 3) / 4 / 1024 / 1024;
};

const extractJson = (raw: string) => {
  const cleaned = (raw || "").replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("A IA não retornou JSON válido.");
  }
};

const getSystemInstruction = (
  settings: AppSettings,
  context: "analysis" | "comparison" | "image_edit" = "analysis"
) => {
  const detailInstruction = {
    Conciso: "Seja breve, técnico e objetivo. Priorize estado de conservação, danos e itens identificados.",
    Normal: "Descreva o estado de conservação with equilíbrio técnico e linguagem objetiva.",
    "Muito Detalhado":
      "Seja minucioso, mas mantenha objetividade técnica. Cite materiais, acabamento, sinais de uso e danos observáveis.",
  }[settings.detailLevel];

  if (context === "comparison") {
    return `Você é David Oliveira (Creci 84926-F), Perito Vistoriador Imobiliário.
Sua tarefa é comparar documentalmente dois laudos, ENTRADA e SAÍDA.
REGRAS:
- Escreva em português do Brasil.
- Seja formal, técnico e objetivo.
- Registre apenas o que for observável ou inferível do conteúdo dos PDFs.
- Identifique divergências, danos novos, piora do estado de conservação e itens ausentes.
- Considere as observações humanas do vistoriador.
- Use Google Search apenas para referência de custos e fontes.
- Não invente informações.
- ${detailInstruction}`;
  }

  if (context === "image_edit") {
    return `Você é um editor de imagens especializado em perícia imobiliária.
Modifique a imagem conforme o comando do usuário para fins documentais.
Mantenha o realismo e a coerência visual.`;
  }

  return `Você é David Oliveira (Creci 84926-F), Vistoriador Profissional.
Sua tarefa é redigir uma descrição técnica de vistoria com base em fotos e vídeos.
REGRAS:
- Escreva em português do Brasil.
- Linguagem formal, objetiva e útil para laudo.
- Não invente informações.
- Se houver baixa certeza, escreva "Necessita validação humana".
- Descreva o cômodo, os itens identificados, o estado de conservação e danos observáveis.
- Use frases curtas e técnicas.
- ${detailInstruction}`;
};

export const editImageAI = async (
  imageData: string,
  prompt: string,
  settings: AppSettings
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = "gemini-2.5-flash-image";
  const base64Data = stripDataUrl(imageData);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg",
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        systemInstruction: getSystemInstruction(settings, "image_edit"),
        imageConfig: {
          aspectRatio: "4:3",
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error("Resposta da IA vazia.");
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
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
  mediaItems: { data: string; mimeType: string }[],
  settings: AppSettings
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = "gemini-3-flash-preview";

  // Gerenciamento de Payload: Limite de ~18MB para segurança (Base64 aumenta o tamanho)
  let totalSize = 0;
  const MAX_TOTAL_SIZE = 18 * 1024 * 1024;
  const usableItems: { data: string; mimeType: string }[] = [];

  for (const item of mediaItems) {
    const itemSize = (item.data.length * 3) / 4;
    if (totalSize + itemSize < MAX_TOTAL_SIZE) {
      usableItems.push(item);
      totalSize += itemSize;
    }
    if (usableItems.length >= 15) break; // Limite de 15 arquivos para análise
  }

  const hasVideo = usableItems.some(item => item.mimeType.startsWith('video/'));

  const parts = [
    {
      text: `Você é David Oliveira (Creci 84926-F), Perito Vistoriador.
Analise as mídias do ambiente "${roomType}" para um laudo de "${inspectionType}".

FOCO DA ANÁLISE:
1. ESTADO DE CONSERVAÇÃO: Descreva de forma concisa o estado geral e de itens específicos.
2. IDENTIFICAÇÃO DE DANOS: Liste avarias, sinais de infiltração, fissuras ou desgastes.
3. TIMESTAMPS PRECISOS: ${hasVideo ? "Para cada dano ou evidência em vídeo, indique o timestamp exato (MM:SS)." : "N/A"}

REGRAS DE RESPOSTA:
- Seja extremamente objetivo e técnico.
- Use termos profissionais (ex: "pintura látex", "esquadrias", "desgaste abrasivo").
- Evite textos longos; prefira descrições diretas.
- Retorne APENAS o JSON solicitado.`,
    },
    ...usableItems.map((item) => ({
      inlineData: {
        data: stripDataUrl(item.data),
        mimeType: item.mimeType,
      },
    })),
  ];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(settings, "analysis"),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricaoGeral: { type: Type.STRING },
            estadoConservacao: {
              type: Type.STRING,
              enum: ["Ótimo", "Bom", "Regular", "Ruim"],
            },
            itensIdentificados: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  estado: { type: Type.STRING },
                  detalhes: { type: Type.STRING },
                },
                required: ["item", "estado", "detalhes"],
              },
            },
            evidenciasDanos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  local: { type: Type.STRING },
                  descricao: { type: Type.STRING },
                  timestamp: { type: Type.STRING, description: "MM:SS onde o dano aparece no vídeo, se aplicável" },
                  gravidade: {
                    type: Type.STRING,
                    enum: ["Baixa", "Média", "Alta"],
                  },
                },
                required: ["local", "descricao", "gravidade"],
              },
            },
          },
          required: [
            "descricaoGeral",
            "estadoConservacao",
            "itensIdentificados",
            "evidenciasDanos",
          ],
        },
      },
    });

    const parsed = extractJson(response.text || "{}");

    return {
      descricaoGeral: parsed.descricaoGeral || "",
      estadoConservacao: parsed.estadoConservacao || "Bom",
      itensIdentificados: Array.isArray(parsed.itensIdentificados) ? parsed.itensIdentificados : [],
      evidenciasDanos: Array.isArray(parsed.evidenciasDanos) ? parsed.evidenciasDanos : [],
    };
  } catch (error) {
    console.error("Erro análise IA:", error);
    throw new Error("Não foi possível concluir a análise do ambiente com IA.");
  }
};

export const performComparisonAI = async (
  entryPdf: string,
  exitPdf: string,
  settings: AppSettings,
  manualObs?: string
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = "gemini-3-flash-preview";

  const entrySize = estimateBase64SizeMB(entryPdf);
  const exitSize = estimateBase64SizeMB(exitPdf);
  const totalSize = entrySize + exitSize;

  if (entrySize > 10 || exitSize > 10 || totalSize > 18) {
    throw new Error(
      "Os PDFs estão muito pesados para comparação direta. Reduza o tamanho dos arquivos ou gere versões mais leves."
    );
  }

  const prompt = `PERÍCIA COMPARATIVA ENTRE LAUDO DE ENTRADA E LAUDO DE SAÍDA

OBJETIVO:
Comparar os dois documentos e apontar divergências documentais relevantes.

ENTREGUE:
1. resumo do estado geral;
2. itens que pioraram;
3. itens que melhoraram;
4. danos novos;
5. observações relevantes;
6. recomendações;
7. estimativa de custos com base em fontes públicas, quando aplicável.

${manualObs ? `OBSERVAÇÕES DO VISTORIADOR:\n${manualObs}` : ""}

Escreva em markdown técnico, com linguagem formal e objetiva.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: stripDataUrl(entryPdf), mimeType: "application/pdf" } },
          { inlineData: { data: stripDataUrl(exitPdf), mimeType: "application/pdf" } },
        ],
      },
      config: {
        systemInstruction: getSystemInstruction(settings, "comparison"),
        tools: [{ googleSearch: {} }],
      },
    });

    const analysis = response.text || "Não foi possível gerar o parecer comparativo.";
    const sources =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => ({
          title: chunk.web?.title || "Fonte consultada",
          uri: chunk.web?.uri,
        }))
        .filter((s: any) => s.uri) || [];

    return { analysis, sources };
  } catch (error: any) {
    console.error("Erro Comparação:", error);

    const message = String(error?.message || "");
    if (message.includes("413") || message.includes("Request Entity Too Large")) {
      throw new Error(
        "Os PDFs enviados excedem o limite aceito para comparação. Gere versões mais leves e tente novamente."
      );
    }

    throw new Error("Erro na comparação pericial. Verifique os PDFs e tente novamente.");
  }
};

export const transcribeAudio = async (
  base64Audio: string,
  settings: AppSettings,
  mimeType: string = "audio/webm"
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            text: `Transcreva este áudio de vistoria em português do Brasil.
Converta para linguagem técnica e objetiva.
Tom: ${settings.tone}.`,
          },
          {
            inlineData: {
              data: stripDataUrl(base64Audio),
              mimeType,
            },
          },
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Erro na transcrição de áudio:", error);
    return "";
  }
};
