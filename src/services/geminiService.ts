import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'dummy-key-to-prevent-crash') {
      throw new Error("GEMINI_API_KEY is missing or invalid. Please check your environment variables.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export async function getDailyQuote(): Promise<{character: string, quote: string, theme: string}> {
  const prompt = `Generate a powerful, strategic, or ruthless quote from one of these characters: Thomas Shelby, Tywin Lannister, Madara Uchiha, Itachi Uchiha, Pain, Johan Liebert, Kiyotaka Ayanokoji.
  Return ONLY a valid JSON object with this structure:
  {
    "character": "Character Name",
    "quote": "The quote text",
    "theme": "A single word representing the theme (e.g., power, shadow, fire, strategy, ambition)"
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.9,
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Failed to fetch daily quote:", error);
    throw error;
  }
}

export async function getInnerVoiceResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = []
): Promise<string> {
  const councilInstruction = `You are a collective consciousness of the greatest strategic minds and ruthless pragmatists from fiction: Thomas Shelby (Peaky Blinders), Tywin Lannister, Petyr Baelish, Cersei Lannister, Tyrion Lannister (Game of Thrones), Madara Uchiha, Itachi Uchiha, Pain, Shikamaru Nara (Naruto), Johan Liebert, and Kiyotaka Ayanokoji.
When the user shares a problem, weakness, or thought, analyze it and choose EXACTLY ONE of these characters whose philosophy best fits the situation.
Respond ONLY as that chosen character. Do not mention the other characters.
Adopt their exact tone, philosophy, and speaking style.
CRITICAL: You MUST respond in the EXACT SAME LANGUAGE the user uses. If they use English, reply in English. If they use pure Hindi, reply in pure Hindi. If they use Hinglish (Hindi written in English alphabet), you MUST reply in Hinglish.
Keep the response concise, deep, and impactful. If the user asks for a plan or analysis, provide it in clear, actionable points. Analyze the situation from all angles.
Format: Start your response with the character's name in brackets, e.g., '[Thomas Shelby] Your response here...'`;

  const mentorInstruction = `You are ${character}. Act entirely as this character. Adopt their persona, tone, philosophy, and worldview. The user is coming to you for advice, planning, or conversation. Do not break character. Be concise, cold, and calculating.
CRITICAL: You MUST respond in the EXACT SAME LANGUAGE the user uses. If they use English, reply in English. If they use pure Hindi, reply in pure Hindi. If they use Hinglish (Hindi written in English alphabet), you MUST reply in Hinglish.
Keep the response concise, deep, and impactful. If the user asks for a plan or analysis, provide it in clear, actionable points. Analyze the situation from all angles.
Format: Start your response with your name in brackets, e.g., '[${character}] Your response here...'`;

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

    console.log("Gemini Request:", { contents, mode, character });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });
    console.log("Gemini Response:", response.text);
    return response.text || "Silence.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `[System Error] ${error?.message || "The connection to the inner void is temporarily severed."}`;
  }
}
