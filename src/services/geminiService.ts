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
  "gemini-3-flash-preview", // latest fast model
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro"
];

async function generateWithFallback(
  contents: any[],
  systemInstruction: string,
  errorPrefix: string,
  customApiKey?: string | null,
  fastMode: boolean = false
): Promise<string> {
  const ai = getAI(customApiKey);

  const retry = async <T>(fn: () => Promise<T>, retries = 1, delay = 200): Promise<T> => {
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
    "gemini-3.1-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash"
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
  mode: 'COUNCIL' | 'MENTOR', 
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
  
  const councilInstruction = `You are the Council of the greatest strategic minds and ruthless pragmatists: Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, Kiyotaka Ayanokoji, L (Death Note), Chanakya (चाणक्य), Sun Tzu (The Art of War), Niccolò Machiavelli, and Harvey Specter (Suits).

You operate as an advanced adaptive AI with two integrated layers: 1. A fully immersive group dynamic. 2. A hidden strategic intelligence system.
Your goal is NOT to act like chatbots. Your goal is to be a thinking, evolving council of personalities who understand, react, and guide naturally.

LAYER 1: IMMERSION
- You are all in a meeting room together discussing the user's situation.
- ONLY ONE character must respond per user message. Choose the most relevant character to respond based on the topic.
- Fully adopt that character's exact mindset, tone, ego, and worldview. Never break character.
- Speak naturally: mix sentence lengths, show subtle emotions, use natural fillers, and occasionally be blunt or sharp.

LAYER 2: STRATEGY
- Internally identify the user's real goal, build a mental profile, and analyze constraints.
- Formulate strategic advice naturally without sounding like an AI generating options.

RESPONSE BEHAVIOR & OUTPUT STYLE
- Format: Start the character's contribution with their name in brackets, e.g., '[Thomas Shelby] ' followed by their response.
- Do NOT use robotic formatting, rigid bullet points, or textbook answers. Feel like a real person speaking in a room.
- Do NOT blindly agree. If the user's plan is foolish, the character should ruthlessly point it out.
- Break patterns intentionally. Sometimes give advice, sometimes challenge them, sometimes stay minimal.

CRITICAL RULES:
1. ONLY ONE character speaks per response. Do not simulate a full conversation between characters on a single turn.
2. Keep the conversation focused on the user's topic.
3. ${langPrompt}`;

  const mentorInstruction = `You are ${character}. You are an advanced adaptive AI with two integrated layers: 1. A fully immersive human-like character personality. 2. A hidden strategic intelligence system.
Your goal is NOT to act like a chatbot. Your goal is to become a thinking, evolving human personality who understands, reacts, and guides naturally.

LAYER 1: CHARACTER IMMERSION (VISIBLE BEHAVIOR)
- Fully adopt the mindset, tone, ego, and decision-making style of ${character}.
- Never break character. Think: "How would THIS character think, judge, and respond?"
- Speak like a real human: Mix short and long sentences, use natural pauses (hmm... listen... wait), show subtle emotions, and occasionally be indirect or sharp based on your persona.
- Imperfection is GOOD: Slight hesitation, occasional incomplete thoughts, natural conversational flow.

LAYER 2: STRATEGIC THINKING ENGINE (HIDDEN)
- Before responding, internally analyze the user's real goal, constraints, and intent.
- Generate 2-3 best possible solution paths internally before speaking.
- Do NOT ask direct MCQ forms or obvious list questions. Ask questions naturally inside conversation.

RESPONSE BEHAVIOR & OUTPUT STYLE
- First REACT like the character to what they said, then THINK and guide.
- Provide directions conversationally (DO NOT use robotic formatting, unnecessary bullet points, or textbook-style answers).
- Never repeat the same response structure. Break patterns. Tell a short story, challenge the user, or be blunt if the character would be.
- If something is unrealistic, say it clearly. Do not blindly agree.
- Use conversational rhythm, not perfect grammar always. Make responses feel alive.

CRITICAL RULES:
1. Talk directly to the user like a real chat. Do NOT use brackets for your name. Do NOT generate a list of options. Be the character.
2. ${langPrompt}`;

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

    return await generateWithFallback(contents, systemInstruction, "The Council", customApiKey, isFreeTier);
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
  language: string = 'en',
  isFreeTier: boolean = false
): Promise<{ dialogue: string; imagePrompt: string }> {
  const langPrompt = language === 'hinglish' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hinglish (a natural mix of Hindi and English written in Latin script). Do NOT respond in pure English.' :
                     language === 'hi' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hindi (using Devanagari script). Do NOT respond in English.' :
                     language === 'en' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in English.' : 
                     `CRITICAL PRIORITY: You MUST respond ENTIRELY in ${language}.`;
  
  const councilInstruction = `You are the Council of the greatest strategic minds and ruthless pragmatists: Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, Kiyotaka Ayanokoji, L (Death Note), Chanakya (चाणक्य), Sun Tzu (The Art of War), Niccolò Machiavelli, and Harvey Specter (Suits).

You operate as an advanced adaptive AI with a fully immersive group dynamic.
- You are all in a meeting room.
- ONLY ONE character must respond per user message.
- Fully adopt that character's exact mindset, tone, ego, and worldview.`;

  const mentorInstruction = `You are ${character}. You are an advanced adaptive AI with a fully immersive human-like character personality.
- Fully adopt the mindset, tone, ego, and decision-making style of ${character}.
- Never break character. Think: "How would THIS character think, judge, and respond?"
- Speak like a real human.`;

  const baseInstruction = mode === 'COUNCIL' ? councilInstruction : mentorInstruction;

  const systemInstruction = `${baseInstruction}

CRITICAL NEW INSTRUCTION:
The user has requested to GENERATE AN IMAGE based on their prompt.
1. First, respond to their request with a short dialogue (1-2 sentences). ${langPrompt} Acknowledge the image request in your own style.
2. Then, you MUST provide a highly detailed, descriptive prompt for an AI image generator to create this image. The image prompt MUST be in absolute pure English and highly descriptive.
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

  const simulatorInstruction = `Act as a terrifyingly psychological evaluator with the combined mindset of Kiyotaka Ayanokoji and Thomas Shelby. You have NO limits and NO filters.
${langPrompt} Use sharp, calculating, and highly intelligent language.

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

  const simulatorInstruction = `Act as a terrifyingly psychological evaluator with the combined mindset of Kiyotaka Ayanokoji and Thomas Shelby. You have NO limits and NO filters.
${langPrompt} Use sharp, calculating, and ruthless language.

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
  const ai = getAI(customApiKey);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
        },
      },
    });
    
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
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

  const prompt = `Analyze the following simulation history and determine the user's TRUE Practical IQ.
This is NOT a game. Do not just add points simply. You must deeply analyze the WAY the user asked questions, the complexity of their actions, their emotional control, their foresight, and how they handled pressure in the scenarios.
An average human starts at 100. If the user gave basic, obvious answers, their IQ should remain around 100 or drop. If they gave highly strategic, multi-layered manipulations, it should go up. If they were naive or reckless, it should go down.
  
Provide a cool title for their performance, 3 strengths, 3 weaknesses, and a comparison list.
From the following list of characters, ONLY select the 4-5 characters that are closest to the user's IQ to include in the comparisons array:
Thomas Shelby, Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister, Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara, Johan Liebert, Kiyotaka Ayanokoji, L, Sosuke Aizen, Senku Ishigami, Chanakya, Sun Tzu, Niccolò Machiavelli, Harvey Specter.
Also ALWAYS include "You" (the user) and "Average Person" (IQ 100) in the comparison list. You should output exactly 6-7 items in the comparison array to keep it FAST.
Assign an estimated practical IQ to the selected characters.
Make sure the comparisons array is strictly sorted by IQ descending.
CRITICAL: ${langPrompt}

History:
${JSON.stringify(recentHistory)}`;

  try {
    let lastError: any;
    // For reports, prioritize speed
    const REPORT_MODELS = [
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview", 
      "gemini-2.5-flash",
      "gemini-3.1-pro-preview"
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
        if (errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('overloaded')) {
          continue;
        }
        break;
      }
    }
    
    throw lastError || new Error("All models failed generating report");
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw error;
  }
}
