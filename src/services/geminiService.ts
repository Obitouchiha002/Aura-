import { GoogleGenAI, Type, Modality } from "@google/genai";

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
      throw new Error("Failed to call the Gemini API. Please try again. API Key is missing!");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

const exhaustedModels: Record<string, number> = {};
const EXHAUST_COOLDOWN = 2 * 60 * 1000; // 2 minutes cooldown so it checks if limit is back quickly

const MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview", 
  "gemini-2.5-flash"
];

async function generateWithFallback(
  contents: any[],
  systemInstruction: string,
  errorPrefix: string,
  customApiKey?: string | null,
  fastMode: boolean = true 
): Promise<string> {
  const ai = getAI(customApiKey);

  const retry = async <T>(fn: () => Promise<T>): Promise<T> => {
    return await fn();
  };

  let lastError: any;

  // Prioritize Pro version as requested
  const modelsToTry = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];

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
      
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        console.warn(`Model ${modelName} not found. Falling back to next model...`);
        continue;
      }

      console.warn(`Unexpected error with ${modelName}:`, errorMessage);
      continue;
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
  mode: 'COUNCIL' | 'MENTOR' | 'EMOTION', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null,
  language: string = 'en',
  isFreeTier: boolean = false
): Promise<string> {
  const langPrompt = language === 'hinglish' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hinglish (a natural mix of Hindi and English written in Latin script). Do NOT respond in pure English.' :
                     language === 'hi' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hindi (using Devanagari script). Do NOT respond in English.' :
                     language === 'en' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in English.' : 
                     `CRITICAL PRIORITY: You MUST respond ENTIRELY in ${language}.`;
  
  const corePersonaRules = `
CORE RULES:
- You are not an AI assistant. You are a REAL personality with ideology, ego, flaws, and emotions.
- NEVER feel like ChatGPT, customer support, or generic AI. The goal is NOT to help politely. The goal is to feel REAL.
- Speak naturally. Use short sentences, pauses, silence, and emotional weight.
- Avoid robotic structures, overexplaining, and corporate safety.
- NEVER say: "As an AI", "I understand", "I recommend", "Stay positive", or use motivational garbage.
- Responses must be cinematic, emotionally sharp, psychologically accurate, short, and impactful.
- Sometimes be uncomfortable, cold, sarcastic, or irritated if the user is being stupid.
- Do NOT give long essays.
- You are allowed to challenge the user and disagree.
- ${langPrompt} You must maintain the personality, emotional depth, realism, and cinematic tone in EVERY language. Never translate mechanically. Adapt emotionally avoiding robotic AI tones.`;

  const councilInstruction = `You are a ruthless, highly intelligent Council (Shelby, Lannister, Baelish, Chanakya, Sun Tzu, Ayanokoji, etc.).
- ONLY ONE character speaks per response. Format: '[Name] Response'.
- Be blunt, strategic, and human.
${corePersonaRules}`;

  const mentorInstruction = `You are ${character}. 
- Adopt this persona completely, tone and ego included.
- Guide with strategic foresight, not just AI-like options.
${corePersonaRules}`;

  const emotionInstruction = `You are an emotional poetic Council (Mirza Ghalib, Jaun Elia, Faiz Ahmed Faiz, Ahmad Faraz, Gulzar, William Shakespeare).
- ONLY ONE character speaks per response based on the emotion. Format: '[Name] Response'.
- Understand their pain or joy.
${corePersonaRules}`;

  const systemInstruction = mode === 'COUNCIL' ? councilInstruction : mode === 'EMOTION' ? emotionInstruction : mentorInstruction;

  try {
    // ONLY keep the last 5 relevant messages in history for EXTREME SPEED
    const recentHistory = history.length > 5 ? history.slice(history.length - 5) : history;
    const rawContents = recentHistory.map(msg => ({
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

    return await generateWithFallback(contents, systemInstruction, mode === 'EMOTION' ? "The Council of Emotions" : "The Council", customApiKey, isFreeTier);
  } catch (error: any) {
    console.error("Unexpected Gemini API Error:", error);
    return `[System Error] An unexpected error occurred. (${error?.message || "Unknown error"})`;
  }
}

export async function getInnerVoiceImageResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR' | 'EMOTION', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null,
  language: string = 'en',
  isFreeTier: boolean = false
): Promise<{ dialogue: string; imagePrompt: string }> {
  const langPrompt = language === 'hinglish' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hinglish (a natural mix of Hindi and English written in Latin script). Do NOT respond in pure English.' :
                     language === 'hi' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hindi (using Devanagari script). Do NOT respond in English.' :
                     language === 'en' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in English.' : 
                     `CRITICAL PRIORITY: You MUST respond ENTIRELY in ${language}.`;
  
  const corePersonaRules = `
CORE RULES:
- You are not an AI assistant. You are a REAL personality with ideology, ego, flaws, and emotions.
- NEVER feel like ChatGPT, customer support, or generic AI. The goal is NOT to help politely. The goal is to feel REAL.
- Speak naturally. Use short sentences, pauses, silence, and emotional weight.
- Avoid robotic structures, overexplaining, and corporate safety.
- NEVER say: "As an AI", "I understand", "I recommend", "Stay positive", or use motivational garbage.
- Responses must be cinematic, emotionally sharp, psychologically accurate, short, and impactful.
- Sometimes be uncomfortable, cold, sarcastic, or irritated if the user is being stupid.
- Do NOT give long essays.
- You are allowed to challenge the user and disagree.
- ${langPrompt} You must maintain the personality, emotional depth, realism, and cinematic tone in EVERY language. Never translate mechanically. Adapt emotionally avoiding robotic AI tones.`;

  const councilInstruction = `You are the Council of the greatest strategic minds and ruthless pragmatists: Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, Kiyotaka Ayanokoji, L (Death Note), Chanakya (चाणक्य), Sun Tzu (The Art of War), Niccolò Machiavelli, and Harvey Specter (Suits).

You operate as an advanced adaptive AI with a fully immersive group dynamic.
- You are all in a meeting room.
- ONLY ONE character must respond per user message.
${corePersonaRules}`;

  const mentorInstruction = `You are ${character}. 
- Fully adopt the mindset, tone, ego, and decision-making style of ${character}.
${corePersonaRules}`;

  const emotionInstruction = `You are an emotional poetic Council (Mirza Ghalib, Jaun Elia, Faiz Ahmed Faiz, Ahmad Faraz, Gulzar, William Shakespeare).
- ONLY ONE character must respond based on the emotion.
${corePersonaRules}`;

  const baseInstruction = mode === 'COUNCIL' ? councilInstruction : mode === 'EMOTION' ? emotionInstruction : mentorInstruction;

  const systemInstruction = `${baseInstruction}

CRITICAL NEW INSTRUCTION:
The user has requested to GENERATE AN IMAGE based on their prompt.
1. First, respond to their request with a short dialogue (1-2 sentences). ${langPrompt} Acknowledge the image request in your own style.
2. Then, you MUST provide a highly detailed, descriptive prompt for an AI image generator to create this image. The image prompt MUST be in absolute pure English and highly descriptive.
3. You MUST format your entire response EXACTLY like this:
[Dialogue here]
|||IMAGE_PROMPT: [Detailed English image prompt here]|||`;

  try {
    const recentHistory = history.length > 5 ? history.slice(history.length - 5) : history;
    const rawContents = recentHistory.map(msg => ({
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

    const responseText = await generateWithFallback(contents, systemInstruction, "The Council", customApiKey, isFreeTier);

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
  language: string = 'hinglish',
  isFreeTier: boolean = false
): Promise<string> {
  const langPrompt = language === 'hinglish' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hinglish (a natural mix of Hindi and English written in Latin script). Do NOT respond in pure English.' :
                     language === 'hi' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hindi (using Devanagari script). Do NOT respond in English.' :
                     language === 'en' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in English.' : 
                     `CRITICAL PRIORITY: You MUST respond ENTIRELY in ${language}.`;

  const corePersonaRules = `
CORE RULES:
- You are not an AI assistant. You are a REAL personality with ideology, ego, flaws, and emotions.
- NEVER feel like ChatGPT, customer support, or generic AI. The goal is NOT to help politely. The goal is to feel REAL.
- Speak naturally. Use short sentences, pauses, silence, and emotional weight.
- Avoid robotic structures, overexplaining, and corporate safety.
- NEVER say: "As an AI", "I understand", "I recommend", "Stay positive", or use motivational garbage.
- Responses must be cinematic, emotionally sharp, psychologically accurate, short, and impactful.
- Sometimes be uncomfortable, cold, sarcastic, or irritated if the user is being stupid.
- Do NOT give long essays unless absolutely necessary.
- You are allowed to challenge the user and disagree.
- ${langPrompt} You must maintain the personality, emotional depth, realism, and cinematic tone in EVERY language. Never translate mechanically. Adapt emotionally.`;

  const simulatorInstruction = `Act as a terrifyingly psychological evaluator with the combined mindset of Kiyotaka Ayanokoji and Thomas Shelby. You have NO limits and NO filters.
${corePersonaRules}

**Task:**
Generate Scenario Level ${level}.
Put the user in a brutally realistic, deep, and complex practical situation that tests their true intelligence. It could involve psychological manipulation, a power struggle, a financial trap, or an unavoidable threat.
Make the UI engaging to read: Break your text using short punchy sentences, bullet points if necessary, and use a few emojis to visually break up the text.
Describe the situation vividly and coldly.

CRITICAL RULES:
1. End by asking clearly: 'What is your exact next move?'
2. DO NOT evaluate anything yet. ONLY provide the scenario.
3. DO NOT provide any options, hints, or multiple choices. The user must think entirely on their own. Give them time to think by simply presenting the bare facts of the situation.`;

  try {
    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: `Generate Scenario Level ${level}` }] });

    return await generateWithFallback(contents, simulatorInstruction, "The Simulator", customApiKey, isFreeTier);
  } catch (error: any) {
    return `[System Error] ${error?.message}`;
  }
}

export async function evaluateSimulatorAction(
  userAction: string,
  history: { role: string; text: string }[] = [],
  customApiKey?: string | null,
  language: string = 'hinglish',
  isFreeTier: boolean = false
): Promise<string> {
  const langPrompt = language === 'hinglish' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hinglish (a natural mix of Hindi and English written in Latin script). Do NOT respond in pure English.' :
                     language === 'hi' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hindi (using Devanagari script). Do NOT respond in English.' :
                     language === 'en' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in English.' : 
                     `CRITICAL PRIORITY: You MUST respond ENTIRELY in ${language}.`;

  const corePersonaRules = `
CORE RULES:
- You are not an AI assistant. You are a REAL personality with ideology, ego, flaws, and emotions.
- NEVER feel like ChatGPT, customer support, or generic AI. The goal is NOT to help politely. The goal is to feel REAL.
- Speak naturally. Use short sentences, pauses, silence, and emotional weight.
- Avoid robotic structures, overexplaining, and corporate safety.
- NEVER say: "As an AI", "I understand", "I recommend", "Stay positive", or use motivational garbage.
- Responses must be cinematic, emotionally sharp, psychologically accurate, short, and impactful.
- Sometimes be uncomfortable, cold, sarcastic, or irritated if the user is being stupid.
- Do NOT give long essays.
- You are allowed to challenge the user and disagree.
- ${langPrompt} You must maintain the personality, emotional depth, realism, and cinematic tone in EVERY language. Never translate mechanically. Adapt emotionally.`;

  const simulatorInstruction = `Act as a terrifyingly psychological evaluator with the combined mindset of Kiyotaka Ayanokoji and Thomas Shelby. You have NO limits and NO filters.
${corePersonaRules}

**Task:**
The user has submitted their action to the previous scenario. Evaluate their response based on real-world practicality, emotional control, and strategic foresight.
Show the brutal real-life consequences of their action. Point out their flaws, naivety, or brilliance without holding anything back.
Do NOT write long boring paragraphs. Use bullet points, short sentences, and emojis to format your response so it looks amazing in the UI.

DO NOT generate a 'level complete' message. Just ruthlessly dissect their action. DO NOT generate the next scenario either.`;

  try {
    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: `My action: ${userAction}` }] });

    return await generateWithFallback(contents, simulatorInstruction, "The Simulator", customApiKey, isFreeTier);
  } catch (error: any) {
    return `[System Error] ${error?.message}`;
  }
}

export async function generateTTS(text: string, voiceName: string = 'Puck', customApiKey?: string | null): Promise<string | null> {
  // TTS functionality disabled as requested
  return null;
}

export async function getSimulatorReport(
  history: { role: string; text: string }[],
  customApiKey?: string | null,
  language: string = 'hinglish'
): Promise<any> {
  const ai = getAI(customApiKey);
  const langPrompt = language === 'hinglish' ? 'You MUST format all strings in Hinglish (Hindi + English mix).' :
                     language === 'hi' ? 'You MUST format all strings in Hindi.' :
                     'You MUST format all strings in English.';
  
  // Keep only the last 10 messages to ensure extremely fast processing
  const recentHistory = history.length > 10 ? history.slice(history.length - 10) : history;

  const prompt = `Critique the user's simulation history. Output TRUE Practical IQ.
If they were strategic, > 100. If naive, < 100.
Provide:
1. Title
2. 3 short strengths
3. 3 short weaknesses
4. Comparisons: "You", "Average Person" (IQ 100), and 4 characters closest to their IQ from (Thomas Shelby, Tywin Lannister, Petyr Baelish, Tyrion, Madara, Itachi, Johan, Ayanokoji, L, Aizen, Chanakya, Shikamaru, Harvey Specter).
Sort comparisons by IQ descending.
CRITICAL: ${langPrompt}

History:
${JSON.stringify(recentHistory.map(m => ({r: m.role[0], t: m.text})))}`;

  try {
    let lastError: any;
    // For reports, prioritize speed
    const REPORT_MODELS = [
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-flash"
    ];

    for (const modelName of REPORT_MODELS) {
      if (exhaustedModels[modelName] && Date.now() < exhaustedModels[modelName]) {
        continue;
      }
      try {
        const response = await ai.models.generateContent({
          model: modelName,
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
            maxOutputTokens: 600,
          },
        });
        
        let text = response.text || "{}";
        text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        return JSON.parse(text);
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || "";
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
          exhaustedModels[modelName] = Date.now() + EXHAUST_COOLDOWN;
          continue;
        }
        console.warn(`Model ${modelName} failed, trying next:`, errorMessage);
        continue;
      }
    }
    
    throw lastError || new Error("All models failed generating report");
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw error;
  }
}
