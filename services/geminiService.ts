import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chave de API do Gemini não encontrada.");
  }
  const ai = new GoogleGenAI({ apiKey });
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chave de API do Gemini não configurada. Verifique as configurações.");
  }

  const ai = new GoogleGenAI({ apiKey });
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
      text: `Você é David Oliveira (Creci 84926-F), Perito Vistoriador Imobiliário Sênior.
Analise detalhadamente as mídias (fotos e vídeos) do ambiente "${roomType}" para um laudo de "${inspectionType}".

SUA MISSÃO:
1. ESTADO DE CONSERVAÇÃO: Avalie o estado de conservação de cada componente visível (piso, paredes, teto, esquadrias, elétrica, hidráulica). Use termos técnicos precisos.
2. IDENTIFICAÇÃO DE DANOS: Identifique qualquer anomalia, por menor que seja (fissuras, manchas de umidade, riscos em piso, pintura descascando, peças soltas, etc.).
3. TIMESTAMPS DE VÍDEO: Para cada dano identificado em vídeo, você DEVE fornecer o timestamp exato (MM:SS). Se houver mais de um vídeo, especifique qual (ex: "Vídeo 1 - 00:15").
4. DETALHAMENTO TÉCNICO: Descreva materiais e acabamentos identificados.

REGRAS CRÍTICAS:
- Responda APENAS em JSON conforme o esquema fornecido.
- Seja extremamente rigoroso e técnico. Não use adjetivos genéricos sem fundamentação.
- Se um item estiver em bom estado, descreva-o como tal, mas cite o material (ex: "Piso cerâmico em bom estado de conservação").
- Para danos, descreva a provável causa se for evidente (ex: "Infiltração ascendente", "Impacto mecânico").`,
    },
    ...usableItems.map((item, index) => ({
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricaoGeral: { 
              type: Type.STRING, 
              description: "Resumo técnico do ambiente, citando dimensões aparentes, iluminação e ventilação." 
            },
            estadoConservacao: {
              type: Type.STRING,
              enum: ["Ótimo", "Bom", "Regular", "Ruim"],
              description: "Classificação geral do ambiente."
            },
            itensIdentificados: {
              type: Type.ARRAY,
              description: "Lista de todos os componentes identificados no ambiente.",
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING, description: "Nome do componente (ex: Porta, Janela, Piso)." },
                  estado: { type: Type.STRING, description: "Estado de conservação (Novo, Bom, Desgastado, etc)." },
                  detalhes: { type: Type.STRING, description: "Descrição técnica do material e acabamento." },
                },
                required: ["item", "estado", "detalhes"],
              },
            },
            evidenciasDanos: {
              type: Type.ARRAY,
              description: "Lista detalhada de todas as avarias e danos encontrados.",
              items: {
                type: Type.OBJECT,
                properties: {
                  local: { type: Type.STRING, description: "Localização exata do dano no ambiente." },
                  descricao: { type: Type.STRING, description: "Descrição técnica detalhada da avaria." },
                  timestamp: { 
                    type: Type.STRING, 
                    description: "Timestamp MM:SS e identificação do vídeo (ex: 'Vídeo 1 - 00:12') se o dano aparecer em vídeo." 
                  },
                  gravidade: {
                    type: Type.STRING,
                    enum: ["Baixa", "Média", "Alta"],
                    description: "Nível de urgência para reparo."
                  },
                  sugestaoReparo: {
                    type: Type.STRING,
                    description: "Sugestão técnica de como sanar o dano."
                  }
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chave de API do Gemini não encontrada.");
  }
  const ai = new GoogleGenAI({ apiKey });
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  const ai = new GoogleGenAI({ apiKey });

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
