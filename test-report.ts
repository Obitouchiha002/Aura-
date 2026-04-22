import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
dotenv.config();

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: "Return my practical IQ based on nothing",
        config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
            practicalIQ: { type: Type.NUMBER, description: "The user's practical IQ score (0-200)" },
            title: { type: Type.STRING, description: "A cool title for their level" },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 strengths" },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 weaknesses" },
            comparisons: {
                type: Type.ARRAY,
                items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    iq: { type: Type.NUMBER },
                    status: { type: Type.STRING }
                },
                required: ["name", "iq", "status"]
                },
                description: "Comparison list sorted by IQ descending"
            }
            },
            required: ["practicalIQ", "title", "strengths", "weaknesses", "comparisons"]
        },
        temperature: 0.2,
        },
    });
    console.log("text:", response.text);
  } catch (err) {
      console.error(err);
  }
}
main();
