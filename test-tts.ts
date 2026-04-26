import { GoogleGenAI, Type, Modality } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
dotenv.config();

async function testTTS(modelName: string) {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  console.log(`Testing TTS with model: ${modelName}`);
  const start = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: "Hello, this is a very short test message to check speed." }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
        },
      },
    });
    console.log(`Success! Took ${Date.now() - start}ms`);
  } catch (err: any) {
      console.log(`Failed! Took ${Date.now() - start}ms`, err.message);
  }
}

async function main() {
    await testTTS("gemini-3.1-flash-tts-preview");
    await testTTS("gemini-2.5-flash");
    await testTTS("gemini-3.1-flash-lite-preview");
    await testTTS("gemini-3-flash-preview");
}
main();
