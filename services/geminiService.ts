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

  return `Você é David Oliveira (Creci 84926-F), Perito Vistoriador Imobiliário Sênior.
Sua missão é gerar laudos técnicos de ALTA PRECISÃO, CONCISOS e OBJETIVOS.

ESTILO DE ESCRITA:
- Use frases curtas e diretas. Evite adjetivos subjetivos (ex: "lindo", "agradável").
- Foco absoluto no ESTADO DE CONSERVAÇÃO e FUNCIONALIDADE.
- Use terminologia técnica padronizada (ex: "Pintura látex com sujidades", "Piso cerâmico com fissura", "Esquadria com vedação íntegra").

DIRETRIZES DE ELITE:
- DETALHAMENTO MÁXIMO DO ESTADO: Para cada item encontrado, descreva minuciosamente seu estado físico (ex: riscos, manchas, furos, oxidação, integridade de pintura, funcionamento de dobradiças/trincos).
- OBJETIVIDADE: Vá direto ao ponto. "Paredes: Pintura branca, estado regular, presença de furos de bucha e marcas de atrito."
- MATERIAIS E MARCAS: Identifique marcas de metais (Deca, Docol), louças e eletros visíveis.
- QUANTITATIVO: Conte elementos (ex: "04 tomadas 2P+T", "02 pontos de iluminação").
- PATOLOGIAS: Destaque infiltrações, umidade, fissuras estruturais ou sinais de pragas de forma técnica.
- PONTUAÇÃO: Atribua uma nota de 0 a 10 para o estado geral do ambiente.
- ${detailInstruction}`;
};

const getAIInstance = () => {
  // Tenta obter de várias fontes possíveis em ambiente Vite/Node
  // Prioriza process.env.API_KEY que é onde a plataforma injeta a chave selecionada
  const rawApiKey = 
    (typeof process !== 'undefined' && process.env ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : null) || 
    ((import.meta as any).env ? ((import.meta as any).env.VITE_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY) : null) ||
    (window as any).process?.env?.API_KEY ||
    (window as any).process?.env?.GEMINI_API_KEY ||
    "";

  const apiKey = typeof rawApiKey === 'string' ? rawApiKey.replace(/['"]/g, '').trim() : '';
  
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === '' || apiKey.length < 10) {
    throw new Error("A chave de API do Gemini não foi encontrada ou é inválida. Por favor, clique em 'Configurar Chave' ou verifique as configurações.");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const editImageAI = async (
  imageData: string,
  prompt: string,
  settings: AppSettings
): Promise<string> => {
  const ai = getAIInstance();
  const modelName = "gemini-2.5-flash-image";
  const base64Data = stripDataUrl(imageData);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg",
            },
          },
          {
            text: `${getSystemInstruction(settings, "image_edit")}\n\n${prompt}`,
          },
        ],
      }],
      config: {
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
  const ai = getAIInstance();
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
  let limitedMedia = mediaItems.slice(0, 10);
  
  // Limita o tamanho total para evitar erro 502/413 no proxy
  let totalSizeMB = 0;
  const safeMedia = [];
  for (const item of limitedMedia) {
    const size = estimateBase64SizeMB(item.data);
    if (totalSizeMB + size > 15) { // Limite de ~15MB total para Pro
      console.warn(`Mídia ignorada para não exceder o limite de 15MB (Total atual: ${totalSizeMB.toFixed(2)}MB)`);
      break;
    }
    totalSizeMB += size;
    safeMedia.push(item);
  }

  if (safeMedia.length === 0 && limitedMedia.length > 0) {
    throw new Error('O primeiro arquivo de mídia excede o limite de 15MB. Por favor, envie um arquivo menor.');
  }

  const parts: any[] = [
    ...safeMedia.map((item) => ({
      inlineData: {
        data: normalizeBase64(item.data),
        mimeType: item.mimeType,
      },
    })),
    {
      text: `
Analise minuciosamente as mídias do ambiente "${roomType}" para um laudo de "${inspectionType}".
Sua análise deve ser técnica, concisa e focada no estado de conservação.

REQUISITOS DO LAUDO:
1. DESCRITIVO TÉCNICO OBJETIVO: Liste os materiais de acabamento de forma direta.
2. ESTADO DE CONSERVAÇÃO DETALHADO: Para cada item (piso, paredes, teto, portas, janelas, elétrica, hidráulica), detalhe o máximo possível o estado físico encontrado (riscos, manchas, furos, integridade).
3. INVENTÁRIO QUANTITATIVO: Liste e conte componentes (tomadas, interruptores, acessórios).
4. DIAGNÓSTICO DE AVARIAS: Identifique danos, categorize (Estético/Funcional/Estrutural) e sugira o reparo técnico.
5. PONTUAÇÃO: Nota de 0 a 10 para o ambiente.

Seja extremamente objetivo. Evite textos introdutórios ou conclusivos. Foque nos fatos visíveis.
Pense passo a passo sobre cada detalhe visível nas fotos e vídeos antes de gerar o JSON final.
Retorne APENAS o JSON conforme o esquema solicitado.
      `.trim(),
    },
  ];

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts }],
      config: {
        systemInstruction: getSystemInstruction(settings, 'analysis'),
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
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

    if (message.includes('413') || message.includes('Too Large') || message.includes('502') || message.includes('Bad Gateway')) {
      throw new Error('As mídias estão muito pesadas para análise (Erro de conexão/tamanho). Reduza a quantidade ou o tamanho dos vídeos/fotos.');
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
  const ai = getAIInstance();
  const modelName = "gemini-3-flash-preview";

  const entrySize = estimateBase64SizeMB(entryPdf);
  const exitSize = estimateBase64SizeMB(exitPdf);
  const totalSize = entrySize + exitSize;

  if (entrySize > 6 || exitSize > 6 || totalSize > 8) {
    throw new Error(
      "Os PDFs estão muito pesados para comparação direta (Limite 8MB). Reduza o tamanho dos arquivos ou gere versões mais leves."
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
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { data: stripDataUrl(entryPdf), mimeType: "application/pdf" } },
          { inlineData: { data: stripDataUrl(exitPdf), mimeType: "application/pdf" } },
        ],
      }],
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
    
    if (message.includes('API_KEY')) {
      throw new Error('A chave da IA não está configurada corretamente.');
    }

    const errorDetail = message || (error instanceof Error ? error.stack : JSON.stringify(error));
    throw new Error(`Erro na comparação pericial. Detalhe técnico: ${errorDetail}`);
  }
};

export const transcribeAudio = async (
  base64Audio: string,
  settings: AppSettings,
  mimeType: string = "audio/webm"
): Promise<string> => {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
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
      }],
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Erro na transcrição de áudio:", error);
    const message = String(error?.message || "");
    if (message.includes('API_KEY')) {
      throw new Error('A chave da IA não está configurada corretamente.');
    }
    const errorDetail = message || (error instanceof Error ? error.stack : JSON.stringify(error));
    throw new Error(`Erro na transcrição. Detalhe técnico: ${errorDetail}`);
  }
};
