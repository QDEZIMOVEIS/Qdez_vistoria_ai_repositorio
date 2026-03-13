import { GoogleGenAI } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({ apiKey: "invalid_key" });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "hello"
    });
    console.log(response.text);
  } catch (e) {
    console.error(e);
  }
}

test();
