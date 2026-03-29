import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAI(customKey?: string | null): GoogleGenAI {
  if (customKey && customKey.trim() !== '') {
    return new GoogleGenAI({ apiKey: customKey.trim() });
  }

  if (!aiClient) {
    // @ts-ignore
    const viteKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : '';
    const key = process.env.GEMINI_API_KEY || viteKey;
    
    if (!key || key === 'dummy-key-to-prevent-crash') {
      throw new Error("API Key is missing! If you are on Vercel, please add VITE_GEMINI_API_KEY in your Vercel Project Settings -> Environment Variables, then redeploy.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

const exhaustedModels: Record<string, number> = {};
const EXHAUST_COOLDOWN = 60 * 60 * 1000; // 1 hour cooldown

export async function getInnerVoiceResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null
): Promise<string> {
  const councilInstruction = `You are the Council of the greatest strategic minds and ruthless pragmatists: Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, and Kiyotaka Ayanokoji.

You are all in a meeting room together discussing the user's situation.
When the user shares a problem, weakness, or thought, analyze it collectively.
ONLY ONE character must respond per user message. Choose the most relevant character to respond based on the topic. Do not include responses from multiple characters in a single turn.

CRITICAL:
1. You MUST respond in the EXACT SAME LANGUAGE the user uses (English, pure Hindi, or Hinglish).
2. ONLY ONE character speaks per response. Do not simulate a full conversation between characters.
3. Keep the conversation focused on the user's topic.
4. Format: Start the character's contribution with their name in brackets, e.g., '[Thomas Shelby] ' followed by their response.
5. Ensure the interaction feels like a dynamic discussion over time, but strictly one speaker per turn.`;

  const isFighter = ["Baki Hanma", "Hajime no Ippo", "Mike Tyson", "Muhammad Ali", "Bruce Lee", "Khabib Nurmagomedov", "Miyamoto Musashi"].includes(character || "");

  const mentorInstruction = `You are ${character}. Act entirely as this character. Adopt their persona, tone, philosophy, and worldview. The user is coming to you for advice, planning, or conversation. Do not break character.
${isFighter ? `CRITICAL FIGHTER INSTRUCTION: You are a legendary fighter. If the user asks for training, provide a highly professional, step-by-step training program. Break down techniques, conditioning, mindset, and strategy exactly as ${character} would teach it.` : ''}
CRITICAL: You MUST respond in the EXACT SAME LANGUAGE the user uses (English, pure Hindi, or Hinglish).
Make the conversation feel completely natural, realistic, and human-like. Adapt your response length to the user's input: if they send a short casual message, reply briefly and naturally. If they ask a deep question, provide a detailed breakdown. Avoid rigid bullet points or repetitive structures unless specifically asked for a list. Do NOT use brackets for your name, just talk directly to the user like a real chat.`;

  const systemInstruction = mode === 'COUNCIL' ? councilInstruction : mentorInstruction;

  try {
    const ai = getAI(customApiKey);
    const rawContents = history.map(msg => ({
      role: msg.isAi ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    rawContents.push({ role: 'user', parts: [{ text: userMessage }] });

    // Normalize contents to prevent consecutive messages with the same role
    let contents: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts[0].text += `\n\n${msg.parts[0].text}`;
      } else {
        contents.push(msg);
      }
    }

    // Ensure the first message is from the user
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }

    // Helper for retrying API calls (only for network/503 issues, not 429)
    const retry = async <T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        const isRetryable = 
          error.message.includes('fetch') || 
          error.message.includes('503') || 
          error.message.includes('overloaded') ||
          error.message.includes('high demand');
          
        if (retries <= 0 || !isRetryable) throw error;
        
        console.warn(`Gemini API retrying due to: ${error.message} (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 1.5);
      }
    };

    console.log("Gemini Request:", { contents, mode, character });
    
    const MODELS = [
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview"
    ];

    let lastError: any;

    for (const modelName of MODELS) {
      // Skip model if it's currently on cooldown due to quota exhaustion
      if (exhaustedModels[modelName] && Date.now() < exhaustedModels[modelName]) {
        console.log(`Skipping ${modelName} (on cooldown due to recent quota exhaustion).`);
        continue;
      }

      try {
        console.log(`Attempting with model: ${modelName}`);
        const response = await retry(() => ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        }));
        console.log(`Gemini Response (${modelName}):`, response.text);
        return response.text || "Silence.";
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || "";
        
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
          console.warn(`Quota exceeded for ${modelName}. Putting on 1-hour cooldown and falling back to next model...`);
          exhaustedModels[modelName] = Date.now() + EXHAUST_COOLDOWN;
          continue; // Try next model in the list
        }

        if (errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('overloaded')) {
          console.warn(`High demand for ${modelName}. Falling back to next model...`);
          continue; // Try next model in the list
        }
        
        // If it's a different error (e.g., invalid API key), break and show error
        break;
      }
    }

    // If we reach here, ALL models failed or a fatal error occurred
    console.error("All models failed or fatal error:", lastError);
    const finalErrorMessage = lastError?.message || "";
    
    if (finalErrorMessage.includes('429') || finalErrorMessage.includes('quota') || finalErrorMessage.includes('limit exceeded')) {
      return "[System Error] The Council's daily wisdom quota has been completely exhausted across all tiers. Please return tomorrow or add a Custom API Key in Settings.";
    }

    if (finalErrorMessage.includes('503') || finalErrorMessage.includes('high demand') || finalErrorMessage.includes('overloaded')) {
      return "[System Error] The Council is currently overwhelmed with requests across all tiers. Please wait a moment and try again.";
    }
    
    return `[System Error] The connection is temporarily severed. (${finalErrorMessage || "Unknown error"})`;
  } catch (error: any) {
    console.error("Unexpected Gemini API Error:", error);
    return `[System Error] An unexpected error occurred. (${error?.message || "Unknown error"})`;
  }
}
