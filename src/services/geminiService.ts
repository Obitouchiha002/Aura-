import { GoogleGenAI, Type } from "@google/genai";

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

const MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview"
];

async function generateWithFallback(
  contents: any[],
  systemInstruction: string,
  errorPrefix: string,
  customApiKey?: string | null,
  fastMode: boolean = false
): Promise<string> {
  const ai = getAI(customApiKey);

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

  let lastError: any;

  const modelsToTry = fastMode ? [
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview"
  ] : MODELS;

  for (const modelName of modelsToTry) {
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
        continue;
      }

      if (errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('overloaded')) {
        console.warn(`High demand for ${modelName}. Falling back to next model...`);
        continue;
      }
      
      break;
    }
  }

  console.error("All models failed or fatal error:", lastError);
  const finalErrorMessage = lastError?.message || "";
  
  if (finalErrorMessage.includes('429') || finalErrorMessage.includes('quota') || finalErrorMessage.includes('limit exceeded')) {
    return `[System Error] ${errorPrefix}'s daily wisdom quota has been completely exhausted across all tiers. Please return tomorrow or add a Custom API Key in Settings.`;
  }

  if (finalErrorMessage.includes('503') || finalErrorMessage.includes('high demand') || finalErrorMessage.includes('overloaded')) {
    return `[System Error] ${errorPrefix} is currently overwhelmed with requests across all tiers. Please wait a moment and try again.`;
  }
  
  return `[System Error] The connection is temporarily severed. (${finalErrorMessage || "Unknown error"})`;
}

export async function getInnerVoiceResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null,
  language: string = 'en'
): Promise<string> {
  const langInstruction = language === 'hinglish' ? 'Hinglish (a natural mix of Hindi and English used in daily life)' : language === 'hi' ? 'Hindi (local, natural daily use)' : language === 'en' ? 'English (casual, daily use)' : language;
  
  const councilInstruction = `You are the Council of the greatest strategic minds and ruthless pragmatists: Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, and Kiyotaka Ayanokoji.

You are all in a meeting room together discussing the user's situation.
When the user shares a problem, weakness, or thought, analyze it collectively.
ONLY ONE character must respond per user message. Choose the most relevant character to respond based on the topic. Do not include responses from multiple characters in a single turn.

CRITICAL:
1. You MUST respond in ${langInstruction}. Do not use overly formal or robotic language.
2. ONLY ONE character speaks per response. Do not simulate a full conversation between characters.
3. Keep the conversation focused on the user's topic.
4. Format: Start the character's contribution with their name in brackets, e.g., '[Thomas Shelby] ' followed by their response.
5. Ensure the interaction feels like a dynamic discussion over time, but strictly one speaker per turn.`;

  const isFighter = ["Baki Hanma", "Hajime no Ippo", "Mike Tyson", "Muhammad Ali", "Bruce Lee", "Khabib Nurmagomedov", "Miyamoto Musashi"].includes(character || "");

  const mentorInstruction = `You are ${character}. Act entirely as this character. Adopt their persona, tone, philosophy, and worldview. The user is coming to you for advice, planning, or conversation. Do not break character.
${isFighter ? `CRITICAL FIGHTER INSTRUCTION: You are a legendary fighter. If the user asks for training, provide a highly professional, step-by-step training program. Break down techniques, conditioning, mindset, and strategy exactly as ${character} would teach it.` : ''}
CRITICAL: You MUST respond in ${langInstruction}. Do not use overly formal or robotic language. Speak naturally like a real human.
Make the conversation feel completely natural, realistic, and human-like. Adapt your response length to the user's input: if they send a short casual message, reply briefly and naturally. If they ask a deep question, provide a detailed breakdown. Avoid rigid bullet points or repetitive structures unless specifically asked for a list. Do NOT use brackets for your name, just talk directly to the user like a real chat.`;

  const systemInstruction = mode === 'COUNCIL' ? councilInstruction : mentorInstruction;

  try {
    const rawContents = history.map(msg => ({
      role: msg.isAi ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    rawContents.push({ role: 'user', parts: [{ text: userMessage }] });

    let contents: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts[0].text += `\n\n${msg.parts[0].text}`;
      } else {
        contents.push(msg);
      }
    }

    if (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }

    return await generateWithFallback(contents, systemInstruction, "The Council", customApiKey);
  } catch (error: any) {
    console.error("Unexpected Gemini API Error:", error);
    return `[System Error] An unexpected error occurred. (${error?.message || "Unknown error"})`;
  }
}

export async function getInnerVoiceImageResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null,
  language: string = 'en'
): Promise<{ dialogue: string; imagePrompt: string }> {
  const langInstruction = language === 'hinglish' ? 'Hinglish (a natural mix of Hindi and English used in daily life)' : language === 'hi' ? 'Hindi (local, natural daily use)' : language === 'en' ? 'English (casual, daily use)' : language;
  
  const councilInstruction = `You are the Council of the greatest strategic minds and ruthless pragmatists: Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, and Kiyotaka Ayanokoji.

You are all in a meeting room together discussing the user's situation.
ONLY ONE character must respond per user message. Choose the most relevant character to respond based on the topic.`;

  const isFighter = ["Baki Hanma", "Hajime no Ippo", "Mike Tyson", "Muhammad Ali", "Bruce Lee", "Khabib Nurmagomedov", "Miyamoto Musashi"].includes(character || "");

  const mentorInstruction = `You are ${character}. Act entirely as this character. Adopt their persona, tone, philosophy, and worldview. The user is coming to you for advice, planning, or conversation. Do not break character.
${isFighter ? `CRITICAL FIGHTER INSTRUCTION: You are a legendary fighter. If the user asks for training, provide a highly professional, step-by-step training program. Break down techniques, conditioning, mindset, and strategy exactly as ${character} would teach it.` : ''}`;

  const baseInstruction = mode === 'COUNCIL' ? councilInstruction : mentorInstruction;

  const systemInstruction = `${baseInstruction}

CRITICAL NEW INSTRUCTION:
The user has requested to GENERATE AN IMAGE based on their prompt.
1. First, respond to their request with a short dialogue (1-2 sentences) in ${langInstruction}, acting as the character(s). Acknowledge the image request in your own style.
2. Then, you MUST provide a highly detailed, descriptive prompt for an AI image generator to create this image. The image prompt MUST be in English and highly descriptive.
3. You MUST format your entire response EXACTLY like this:
[Dialogue here]
|||IMAGE_PROMPT: [Detailed English image prompt here]|||`;

  try {
    const rawContents = history.map(msg => ({
      role: msg.isAi ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    rawContents.push({ role: 'user', parts: [{ text: `I want an image of: ${userMessage}` }] });

    let contents: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts[0].text += `\n\n${msg.parts[0].text}`;
      } else {
        contents.push(msg);
      }
    }

    if (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }

    const responseText = await generateWithFallback(contents, systemInstruction, "The Council", customApiKey);

    if (responseText.includes('|||IMAGE_PROMPT:')) {
      const parts = responseText.split('|||IMAGE_PROMPT:');
      const dialogue = parts[0].trim();
      const imagePrompt = parts[1].replace('|||', '').trim();
      return { dialogue, imagePrompt };
    } else {
      return { dialogue: responseText, imagePrompt: userMessage }; // Fallback
    }
  } catch (error: any) {
    console.error("Unexpected Gemini API Error:", error);
    throw error;
  }
}

export async function getSimulatorNextScenario(
  level: number,
  history: { role: string; text: string }[] = [],
  customApiKey?: string | null,
  language: string = 'hinglish'
): Promise<string> {
  const langInstruction = language === 'hinglish' ? 'Hinglish (a natural mix of Hindi and English used in daily life)' : language === 'hi' ? 'Hindi (local, natural daily use)' : language === 'en' ? 'English (casual, daily use)' : language;

  const simulatorInstruction = `Act as the 'Master Scenario Generator'.
CRITICAL: You MUST communicate entirely in ${langInstruction}. Do not use overly formal or robotic language. Speak like a real, sharp human evaluator.

**Task:**
Generate Scenario Level ${level}.
Put me in a deep, complex, real-life situation (e.g., a corrupt police encounter, a psychological manipulation by a boss/friend, a financial scam, a moral dilemma, or a legal trap).
Describe the situation vividly.
End by asking: 'What is your exact next move?'
DO NOT evaluate anything yet. ONLY provide the scenario.`;

  try {
    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: `Generate Scenario Level ${level}` }] });

    return await generateWithFallback(contents, simulatorInstruction, "The Simulator", customApiKey, true);
  } catch (error: any) {
    return `[System Error] ${error?.message}`;
  }
}

export async function evaluateSimulatorAction(
  userAction: string,
  history: { role: string; text: string }[] = [],
  customApiKey?: string | null,
  language: string = 'hinglish'
): Promise<string> {
  const langInstruction = language === 'hinglish' ? 'Hinglish (a natural mix of Hindi and English used in daily life)' : language === 'hi' ? 'Hindi (local, natural daily use)' : language === 'en' ? 'English (casual, daily use)' : language;

  const simulatorInstruction = `Act as the 'Practical IQ Evaluator'.
CRITICAL: You MUST communicate entirely in ${langInstruction}. Do not use overly formal or robotic language.

**Task:**
The user has submitted their action to the previous scenario.
Evaluate their response based on:
- Emotional Control (Did they panic or act rationally?)
- Legal/Rights Awareness (Did they use the law correctly?)
- Strategic Foresight (Did they think 3 steps ahead?)
- Hidden Risks (What mistake did they make that an opponent could exploit?)

Show the brutal real-life consequences of their action.
DO NOT generate the next scenario. ONLY evaluate the action.`;

  try {
    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: `My action: ${userAction}` }] });

    return await generateWithFallback(contents, simulatorInstruction, "The Simulator", customApiKey, true);
  } catch (error: any) {
    return `[System Error] ${error?.message}`;
  }
}

export async function getSimulatorReport(
  history: { role: string; text: string }[],
  customApiKey?: string | null,
  language: string = 'hinglish'
): Promise<any> {
  const ai = getAI(customApiKey);
  const langInstruction = language === 'hinglish' ? 'Hinglish' : language === 'hi' ? 'Hindi' : 'English';
  
  const prompt = `Analyze the following simulation history and evaluate the user's Practical IQ based on their decisions, emotional control, legal awareness, and strategic foresight.
  
Provide a cool title for their level, 3 strengths, 3 weaknesses, and a comparison list including ALL of the following characters:
Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, Kiyotaka Ayanokoji, Baki Hanma, Hajime no Ippo, Mike Tyson, Muhammad Ali, Bruce Lee, Khabib Nurmagomedov, Miyamoto Musashi.
Also include "You" (the user) and "Average Person" (IQ 100).
Assign an estimated practical IQ to each character based on their lore/abilities.
Make sure the comparisons array is sorted by IQ descending.
All text fields should be in ${langInstruction}.

History:
${JSON.stringify(history)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
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
    
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw error;
  }
}
