import { GoogleGenAI, Type } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Say hi and return JSON { msg: 'hi' }",
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: { msg: { type: Type.STRING } },
        }
    }
  });
  console.log("text:", response.text);
}
main();
