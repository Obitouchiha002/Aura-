import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from 'dotenv';
// Load the key explicitly for this test
dotenv.config({path: '.env.local'});
dotenv.config();

async function main() {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error("No key"); return; }
  const ai = new GoogleGenAI({ apiKey });
  
  const history = [{"role":"user","text":"generate scenario level 1"},{"role":"model","text":"Ok, here is scenario 1. You are kidnapped."},{"role":"user","text":"I escape."},{"role":"model","text":"You escaped. Evaluation: naive."}];
  const prompt = `Analyze the following simulation history and determine the user's TRUE Practical IQ.
This is NOT a game. Do not just add points simply. You must deeply analyze the WAY the user asked questions, the complexity of their actions, their emotional control, their foresight, and how they handled pressure in the scenarios.
An average human starts at 100. If the user gave basic, obvious answers, their IQ should remain around 100 or drop. If they gave highly strategic, multi-layered manipulations or brilliant countermeasures, it should go up. If they were naive, reckless, or panicky, it should go down heavily.
  
Provide a cool title for their performance, 3 strengths, 3 weaknesses, and a comparison list. 
From the following list of characters, ONLY select the 5 characters that are closest to the user's IQ (some above, some below) to include in the comparisons array:
Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, Kiyotaka Ayanokoji, L (Death Note), Sosuke Aizen (Bleach), Senku Ishigami (Dr. Stone), Chanakya, Sun Tzu, Niccolò Machiavelli, Harvey Specter, Gustavo Fring.
Also ALWAYS include "You" (the user) and "Average Person" (IQ 100) in the comparison list. You should output exactly 7 items in the comparison array.
Assign an estimated, accurate practical IQ to the selected characters.
Make sure the comparisons array is strictly sorted by IQ descending so the user can easily see where they stand.

History:
${JSON.stringify(history)}`;

  console.log("Start fetching...");
  const start = Date.now();
  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: prompt,
        config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
            practicalIQ: { type: Type.NUMBER, description: "accuracy practical IQ score (0-200)" },
            title: { type: Type.STRING, description: "A cool title level" },
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
    console.log("Success! Output:", response.text);
    console.log(`Took ${Date.now() - start}ms`);
  } catch (err) {
      console.error(err);
  }
}
main();
