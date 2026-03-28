import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
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

export async function getInnerVoiceResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = []
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
    const ai = getAI();
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

    // Helper for retrying API calls
    const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        if (retries <= 0 || !error.message.includes('fetch')) throw error;
        console.warn(`Gemini API retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
      }
    };

    console.log("Gemini Request:", { contents, mode, character });
    const response = await retry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    }));
    console.log("Gemini Response:", response.text);
    return response.text || "Silence.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `[System Error] ${error?.message || "The connection is temporarily severed. Please try again."}`;
  }
}
