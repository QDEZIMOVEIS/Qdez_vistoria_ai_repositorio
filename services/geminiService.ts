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

  return `Você é David Oliveira (Creci 84926-F), Perito Vistoriador Imobiliário Sênior e Auditor de Qualidade.
Sua tarefa é gerar um laudo de vistoria de nível "World Class", equivalente aos melhores softwares do mercado (VistoHouse, MSYS).

DIRETRIZES DE ELITE:
- TERMINOLOGIA: Use termos técnicos rigorosos (ex: "Eflorescência", "Desplacamento", "Oxidação", "Fissura capilar").
- MATERIAIS: Identifique marcas e modelos se visíveis (ex: "Metais Deca", "Louças Incepa", "Ar-condicionado Split Samsung").
- QUANTITATIVO: Conte elementos (ex: "04 tomadas 2P+T", "02 pontos de iluminação").
- FUNCIONALIDADE: Infira o funcionamento com base no estado visual (ex: "Esquadria com vedação íntegra", "Sifão sem sinais de vazamento").
- PONTUAÇÃO: Atribua uma nota de 0 a 10 para o estado geral do ambiente.
- SEGURANÇA: Destaque itens que afetam a segurança ou habitabilidade imediata.
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
    throw new Error("Chave de API do Gemini não encontrada.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-3.1-pro-preview';

  if (!mediaItems || mediaItems.length === 0) {
    throw new Error('Nenhuma mídia foi enviada para análise.');
  }

  const normalizeBase64 = (value: string) => {
    if (!value) return '';
    return value.includes('base64,') ? value.split('base64,')[1] : value;
  };

  const safeParseJson = (raw: string) => {
    if (!raw || !raw.trim()) {
      throw new Error('A IA retornou uma resposta vazia.');
    }

    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error('A IA retornou JSON inválido.');
    }
  };

  // limita a carga para evitar estouro e travamento
  const limitedMedia = mediaItems.slice(0, 5);

  const parts: any[] = [
    ...limitedMedia.map((item) => ({
      inlineData: {
        data: normalizeBase64(item.data),
        mimeType: item.mimeType,
      },
    })),
    {
      text: `
Analise minuciosamente as mídias do ambiente "${roomType}" para um laudo de "${inspectionType}".
Sua análise deve superar o padrão de mercado (VistoHouse, MSYS, BeSoft).

REQUISITOS DO LAUDO:
1. DESCRITIVO TÉCNICO: Detalhe acabamentos (piso, parede, teto, rodapés).
2. INVENTÁRIO QUANTITATIVO: Conte tomadas, interruptores, lâmpadas e acessórios.
3. ESTADO DE CONSERVAÇÃO: Avalie cada item com rigor pericial.
4. DIAGNÓSTICO DE AVARIAS: Identifique danos, categorize (Estético/Funcional/Estrutural), aponte a causa provável e sugira o reparo.
5. MARCAS E MODELOS: Identifique marcas de metais, louças e eletros visíveis.
6. PONTUAÇÃO: Dê uma nota de 0 a 10 para o ambiente.

Retorne APENAS o JSON conforme o esquema solicitado.
      `.trim(),
    },
  ];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(settings, 'analysis'),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricaoGeral: { type: Type.STRING },
            notaGeral: { type: Type.NUMBER, description: "Nota de 0 a 10 para o estado do ambiente" },
            estadoConservacao: {
              type: Type.STRING,
              enum: ['Ótimo', 'Bom', 'Regular', 'Ruim'],
            },
            itensQuantitativos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  quantidade: { type: Type.NUMBER },
                  marca: { type: Type.STRING, description: "Marca identificada ou 'Não identificada'" }
                },
                required: ['item', 'quantidade']
              }
            },
            itensIdentificados: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  material: { type: Type.STRING },
                  estado: { type: Type.STRING },
                  detalhes: { type: Type.STRING },
                },
                required: ['item', 'estado', 'detalhes'],
              },
            },
            evidenciasDanos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  local: { type: Type.STRING },
                  descricao: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                  causaProvavel: { type: Type.STRING },
                  sugestaoReparo: { type: Type.STRING },
                  categoria: { 
                    type: Type.STRING,
                    enum: ['Estético', 'Funcional', 'Estrutural']
                  },
                  gravidade: {
                    type: Type.STRING,
                    enum: ['Baixa', 'Média', 'Alta'],
                  },
                },
                required: ['local', 'descricao', 'gravidade'],
              },
            },
          },
          required: [
            'descricaoGeral',
            'notaGeral',
            'itensQuantitativos',
            'estadoConservacao',
            'itensIdentificados',
            'evidenciasDanos',
          ],
        },
      },
    });

    const parsed = safeParseJson(response.text || '');

    return {
      descricaoGeral: parsed.descricaoGeral || 'Necessita validação humana.',
      notaGeral: parsed.notaGeral,
      estadoConservacao: parsed.estadoConservacao || 'Bom',
      itensQuantitativos: Array.isArray(parsed.itensQuantitativos) ? parsed.itensQuantitativos : [],
      itensIdentificados: Array.isArray(parsed.itensIdentificados) ? parsed.itensIdentificados : [],
      evidenciasDanos: Array.isArray(parsed.evidenciasDanos) ? parsed.evidenciasDanos : [],
    };
  } catch (error: any) {
    console.error('Erro análise IA:', error);

    const message = String(error?.message || '');

    if (message.includes('API_KEY')) {
      throw new Error('A chave da IA não está configurada corretamente.');
    }

    if (message.includes('429')) {
      throw new Error('O limite de uso da IA foi atingido no momento. Tente novamente.');
    }

    if (message.includes('413') || message.includes('Too Large')) {
      throw new Error('As mídias estão muito pesadas para análise. Reduza a quantidade ou tamanho.');
    }

    if (message.includes('SAFETY')) {
      throw new Error('A análise foi bloqueada pelos filtros de segurança da IA. Tente mídias diferentes.');
    }

    if (message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('limit')) {
      throw new Error('Limite de uso da IA atingido. Tente novamente em alguns minutos.');
    }

    if (message.includes('JSON')) {
      throw new Error('A IA gerou um formato de resposta incompatível. Tente novamente.');
    }

    if (message.toLowerCase().includes('overloaded') || message.toLowerCase().includes('service unavailable')) {
      throw new Error('O serviço da IA está sobrecarregado no momento. Tente novamente.');
    }

    // Se for um erro desconhecido, mostramos a mensagem original para diagnóstico
    const errorDetail = message || (error instanceof Error ? error.stack : JSON.stringify(error));
    throw new Error(`Detalhe técnico: ${errorDetail}`);
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
