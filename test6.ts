import { GoogleGenAI } from "@google/genai";

async function test() {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-goog-api-key",
      "Origin": "http://localhost:3000"
    }
  });
  console.log(response.status);
  console.log(await response.text());
}

test();
