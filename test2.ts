import { GoogleGenAI } from "@google/genai";

async function test() {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": "invalid_key"
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "hello" }] }]
    })
  });
  console.log(await response.json());
}

test();
