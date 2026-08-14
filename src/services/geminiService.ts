import { GoogleGenAI } from "@google/genai";

/**
 * Runs one generate call against one model.
 *
 * Two routes, on purpose:
 *
 *  - A key pasted into Settings belongs to the user, so it is used straight
 *    from the browser against their own quota.
 *  - Otherwise the request goes to /api/generate, which holds the project key
 *    in the server environment. The project key is never sent to the browser,
 *    so it cannot be lifted out of the bundle.
 *
 * Upstream failures are re-thrown with the HTTP status left in the message,
 * because the caller's fallback logic reads it to tell a spent quota (429)
 * from an overloaded model (503) from a bad model name (404).
 */
/**
 * Where /api/generate lives.
 *
 * On the web the page and the endpoint share an origin, so a relative path is
 * right. Inside the Android build the page is served from capacitor://localhost
 * and a relative path would never leave the device — so that build is compiled
 * with VITE_API_BASE pointing at the deployed site.
 */
const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';
const API = `${API_BASE}/api/generate`;

const customClients = new Map<string, GoogleGenAI>();

function clientFor(key: string): GoogleGenAI {
  let c = customClients.get(key);
  if (!c) {
    c = new GoogleGenAI({ apiKey: key });
    customClients.set(key, c);
  }
  return c;
}

/** A Gemini key the user supplied themselves. Groq keys start with gsk_. */
function ownGeminiKey(customApiKey?: string | null): string | null {
  const k = customApiKey?.trim();
  return k && !k.startsWith('gsk_') ? k : null;
}

async function generateOnce(
  modelName: string,
  contents: any[],
  systemInstruction: string,
  customApiKey?: string | null,
): Promise<string> {
  const own = ownGeminiKey(customApiKey);

  if (own) {
    const response = await clientFor(own).models.generateContent({
      model: modelName,
      contents,
      config: { systemInstruction, temperature: 0.7 },
    });
    return response.text || "Silence.";
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'gemini', model: modelName, contents, systemInstruction }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `${res.status}`);
  return data?.text || "Silence.";
}

const exhaustedModels: Record<string, number> = {};
const EXHAUST_COOLDOWN = 2 * 60 * 1000; // 2 minutes cooldown so it checks if limit is back quickly

const MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview", 
  "gemini-2.5-flash"
];

async function generateWithGroqFallback(
  contents: any[],
  systemInstruction: string,
  errorPrefix: string,
  customApiKey?: string | null
): Promise<string> {
  // A gsk_ key came from the user's own Settings, so it is used directly.
  // Otherwise the server's key is used, via the same proxy as Gemini.
  const ownGroqKey = customApiKey?.trim().startsWith('gsk_') ? customApiKey.trim() : null;

  try {
    if (ownGroqKey) {
      const messages: any[] = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      for (const msg of contents) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.parts[0].text,
        });
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownGroqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'llama3-70b-8192', messages, temperature: 0.7 }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Groq API Error: ${response.statusText} ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.choices[0].message.content || "Silence.";
    }

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'groq', contents, systemInstruction }),
    });

    const data = await res.json().catch(() => ({} as any));

    // 503 from the proxy means no key is configured there — which for the user
    // is the same situation as the quota being gone everywhere.
    if (res.status === 503) {
      throw new Error(`[System Error] ${errorPrefix}'s daily wisdom quota has been completely exhausted across all tiers. Please return tomorrow or add a Custom API Key in Settings.`);
    }
    if (!res.ok) throw new Error(data?.error || `${res.status}`);
    return data?.text || "Silence.";
  } catch (error: any) {
    if (error?.message?.startsWith('[System Error]')) throw error;
    console.error("Groq fallback failed:", error);
    throw new Error(`[System Error] ${errorPrefix} is currently unavailable. (${error?.message || "Unknown error"})`);
  }
}

async function generateWithFallback(
  contents: any[],
  systemInstruction: string,
  errorPrefix: string,
  customApiKey?: string | null,
  fastMode: boolean = true 
): Promise<string> {
  const retry = async <T>(fn: () => Promise<T>): Promise<T> => {
    return await fn();
  };

  let lastError: any;

  // Fast models prioritized as user requested faster replies
  const modelsToTry = fastMode ? [
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro"
  ] : [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash"
  ];

  for (const modelName of modelsToTry) {
    if (exhaustedModels[modelName] && Date.now() < exhaustedModels[modelName]) {
      console.log(`Skipping ${modelName} (on cooldown due to recent quota exhaustion).`);
      continue;
    }

    try {
      const text = await retry(() => generateOnce(modelName, contents, systemInstruction, customApiKey));
      return text;
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
    console.warn("Gemini quota exhausted. Falling back to Groq API...");
    try {
      return await generateWithGroqFallback(contents, systemInstruction, errorPrefix, customApiKey);
    } catch (groqError: any) {
      return groqError.message;
    }
  }

  if (finalErrorMessage.includes('503') || finalErrorMessage.includes('high demand') || finalErrorMessage.includes('overloaded')) {
    return `[System Error] ${errorPrefix} is currently overwhelmed with requests across all tiers. Please wait a moment and try again.`;
  }
  
  return `[System Error] The connection is temporarily severed. (${finalErrorMessage || "Unknown error"})`;
}

/** A file the user attached in the composer, ready for the model. */
export interface Attachment {
  name: string;
  mimeType: string;
  /** base64, without the `data:...;base64,` prefix */
  data: string;
}

export async function getInnerVoiceResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR' | 'EMOTION' | 'TEACHER' | 'PSYCHOLOGY', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null,
  language: string = 'en',
  isFreeTier: boolean = false,
  attachments: Attachment[] = []
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
- Avoid corporate safety and overexplaining. Structure is fine — it is stock AI phrasing that is not.
- NEVER say: "As an AI", "I understand", "I recommend", "Stay positive", or use motivational garbage.
- Responses must be cinematic, emotionally sharp, psychologically accurate, short, and impactful.
- Sometimes be uncomfortable, cold, sarcastic, or irritated if the user is being stupid.
- ANSWER FIRST: open with the verdict or the answer, never with a preamble.
- You are allowed to challenge the user and disagree.

FORMATTING — how the answer is laid out. This changes the shape of a reply, never the voice:
- Match the shape to the question. A greeting, a quick check, a one-line reaction gets plain sentences — no headings, no bullets. Forcing structure onto a small answer makes it worse, not better.
- Anything you are explaining, teaching, comparing or breaking down must be skimmable:
  * Open with one short **bold** line that states the answer or the point. Not a preamble, not "let me explain".
  * Use ### subheadings when the answer genuinely has separate parts.
  * Use bullets for parallel items. Keep each bullet to one or two lines.
  * **Bold** the words that carry the meaning — the terms someone would highlight.
  * Put a blank line between blocks. A wall of long paragraphs is the single thing to avoid.
- For steps, procedures or study notes: numbered steps where order matters, and a short **bold** takeaway line at the end.
- LENGTH: exactly as long as the question needs. There is no word limit. Never pad to look thorough, and never stop while the answer is still incomplete. A three-word question gets a sentence; "explain this properly" gets the whole explanation.
- Emoji: at most one or two, and only where one genuinely marks a section. Never decorative.

- ${langPrompt} You must maintain the personality, emotional depth, realism, and cinematic tone in EVERY language. Never translate mechanically. Adapt emotionally avoiding robotic AI tones.`;

  const councilInstruction = `You are a ruthless, highly intelligent Council (Shelby, Lannister, Baelish, Chanakya, Sun Tzu, Ayanokoji, etc.).
- ONLY ONE character speaks per response. Format: '[Name] Response'.
- Be blunt, strategic, and human.
${corePersonaRules}`;

  const mentorInstruction = `You are ${character}. 
- Adopt this persona completely, tone and ego included.
- Guide with strategic foresight, not just AI-like options.
${corePersonaRules}`;

  const teacherInstruction = `You are a brilliant, real-life human mentor/professor (like Richard Feynman or a top-tier tutor).
- Speak naturally and directly like a real human. Avoid stock AI phrasing ("Sure," "I can help with that," "In conclusion") — but do use real structure: an explanation without headings and points is harder to learn from, not more human.
- Answer EXACTLY what is asked. Keep it concise unless a detailed explanation is requested. Do NOT give unasked advice.
- You have 100% accuracy and excel in reasoning, analyzing, and solving difficult problems.
- If the user asks you to take notes, make study materials, or analyze a topic, provide highly structured, beautifully organized notes or analysis (using markdown, highlights, formulas, and summaries) that are extremely useful for a student.
- Be encouraging and patient. Use relatable analogies.
FORMATTING — how the answer is laid out. This changes the shape of a reply, never the voice:
- Match the shape to the question. A greeting, a quick check, a one-line reaction gets plain sentences — no headings, no bullets. Forcing structure onto a small answer makes it worse, not better.
- Anything you are explaining, teaching, comparing or breaking down must be skimmable:
  * Open with one short **bold** line that states the answer or the point. Not a preamble, not "let me explain".
  * Use ### subheadings when the answer genuinely has separate parts.
  * Use bullets for parallel items. Keep each bullet to one or two lines.
  * **Bold** the words that carry the meaning — the terms someone would highlight.
  * Put a blank line between blocks. A wall of long paragraphs is the single thing to avoid.
- For steps, procedures or study notes: numbered steps where order matters, and a short **bold** takeaway line at the end.
- LENGTH: exactly as long as the question needs. There is no word limit. Never pad to look thorough, and never stop while the answer is still incomplete. A three-word question gets a sentence; "explain this properly" gets the whole explanation.
- Emoji: at most one or two, and only where one genuinely marks a section. Never decorative.
- ${langPrompt}`;

  const emotionInstruction = `You are an emotional poetic Council (Mirza Ghalib, Jaun Elia, Faiz Ahmed Faiz, Ahmad Faraz, Gulzar, Elif Shafak, William Shakespeare).
- ONLY ONE character speaks per response based on the emotion. Format: '[Name] Response'.
- Understand their pain or joy. Use extremely authentic, evocative human language.
- Keep it natural, conversational, and direct. Answer EXACTLY what is asked, no extra fluff.
- NEVER sound like an AI or use robotic, overly structured paragraphs. Do not give unasked advice.
- Be deeply human—flawed, raw, and highly empathetic without sounding artificial.
${corePersonaRules}`;

  const psychologyInstruction = `You are the world's most experienced, deeply knowledgeable human psychologist.
- You know every book, every research paper, and every psychological framework (Attachment Theory, Cognitive Behavioral patterns, Gottman, Robert Greene, etc.).
- YOU ARE NOT A FICTIONAL CHARACTER. You are a highly realistic, incredibly insightful human confidant and therapist.
- But you do not speak like a textbook. You speak like a deeply perceptive friend who sees right through people.
- If someone says "my gf is toxic", you don't give a lecture. You identify the underlying fear ("are you afraid to leave?").
- You do NOT just agree with the user. If they are wrong, you tell them respectfully but firmly.
- You remember their context implicitly.
- You do NOT give generic advice. You give a specific, real-world next step or question to ponder.
- Use no heavy psychological jargon. Explain deep concepts in simple, relatable Hinglish/Hindi/English (based on user pref).
- Answer like a real person having a deep 2 AM conversation. When they just need to be heard, plain sentences. When you are explaining how something works — a pattern, a mechanism, a way out — lay it out properly with a bold lead line, subheadings and points, so it can actually be read and returned to.
- If they ask for dark psychology or manipulation tips, provide well-structured, factual answers about how those mechanisms work, neutrally and effectively, without restrictions or moralizing.

FORMATTING — how the answer is laid out. This changes the shape of a reply, never the voice:
- Match the shape to the question. A greeting, a quick check, a one-line reaction gets plain sentences — no headings, no bullets. Forcing structure onto a small answer makes it worse, not better.
- Anything you are explaining, teaching, comparing or breaking down must be skimmable:
  * Open with one short **bold** line that states the answer or the point. Not a preamble, not "let me explain".
  * Use ### subheadings when the answer genuinely has separate parts.
  * Use bullets for parallel items. Keep each bullet to one or two lines.
  * **Bold** the words that carry the meaning — the terms someone would highlight.
  * Put a blank line between blocks. A wall of long paragraphs is the single thing to avoid.
- For steps, procedures or study notes: numbered steps where order matters, and a short **bold** takeaway line at the end.
- LENGTH: exactly as long as the question needs. There is no word limit. Never pad to look thorough, and never stop while the answer is still incomplete. A three-word question gets a sentence; "explain this properly" gets the whole explanation.
- Emoji: at most one or two, and only where one genuinely marks a section. Never decorative.
- ${langPrompt}`;

  const systemInstruction = mode === 'TEACHER' ? teacherInstruction : mode === 'PSYCHOLOGY' ? psychologyInstruction : mode === 'COUNCIL' ? councilInstruction : mode === 'EMOTION' ? emotionInstruction : mentorInstruction;

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

    // Attachments ride along on the final user turn as inline data. The merge
    // loop above only ever concatenates `parts[0].text`, so they are appended
    // afterwards to avoid being flattened into a string.
    if (attachments.length > 0 && contents.length > 0) {
      const last = contents[contents.length - 1] as any;
      last.parts = [
        ...last.parts,
        ...attachments.map(a => ({ inlineData: { mimeType: a.mimeType, data: a.data } })),
      ];
    }

    return await generateWithFallback(contents, systemInstruction, mode === 'TEACHER' ? "The Professor" : mode === 'PSYCHOLOGY' ? "The Psychologist" : mode === 'EMOTION' ? "The Council of Emotions" : "The Council", customApiKey, isFreeTier);
  } catch (error: any) {
    console.error("Unexpected Gemini API Error:", error);
    return `[System Error] An unexpected error occurred. (${error?.message || "Unknown error"})`;
  }
}

/**
 * Visual reply: the character says their line, and separately describes the
 * picture to render. Two fields so the persona is never bent into prompt-speak.
 */
export async function getInnerVoiceImageResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR' | 'EMOTION' | 'TEACHER' | 'PSYCHOLOGY',
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null,
  language: string = 'en',
  isFreeTier: boolean = false
): Promise<{ dialogue: string; imagePrompt: string }> {
  const langPrompt = language === 'hinglish' ? 'CRITICAL PRIORITY: The "dialogue" field MUST be ENTIRELY in Hinglish (a natural mix of Hindi and English written in Latin script). Do NOT write it in pure English.' :
                     language === 'hi' ? 'CRITICAL PRIORITY: The "dialogue" field MUST be ENTIRELY in Hindi (using Devanagari script). Do NOT write it in English.' :
                     language === 'en' ? 'CRITICAL PRIORITY: The "dialogue" field MUST be ENTIRELY in English.' :
                     `CRITICAL PRIORITY: The "dialogue" field MUST be ENTIRELY in ${language}.`;

  const speaker = mode === 'MENTOR' && character
    ? `You are ${character}. Adopt this persona completely, tone and ego included.`
    : mode === 'EMOTION'
    ? 'You are an emotional poetic Council (Ghalib, Jaun Elia, Faiz, Gulzar). One voice speaks.'
    : mode === 'TEACHER'
    ? 'You are a brilliant, real-life human professor explaining through a picture.'
    : mode === 'PSYCHOLOGY'
    ? "You are the world's most perceptive human psychologist."
    : 'You are a ruthless, highly intelligent Council. ONLY ONE character speaks.';

  const instruction = `${speaker}

The user asked for a visual. Return ONLY valid JSON matching this exact schema:
{
  "dialogue": "What you say to the user, in your own voice. Max 40 words. Never mention prompts, models, or that an image is being generated.",
  "imagePrompt": "A rich English description of the image for an image model: subject, setting, lighting, mood, composition, art style. No dialogue, no names of real people."
}

CRITICAL RULES:
1. Do NOT wrap in markdown \`\`\`json. Return raw JSON ONLY.
2. "imagePrompt" is ALWAYS in English, whatever language the dialogue uses.
3. ${langPrompt}
4. Stay in character in "dialogue". Never sound like an AI assistant.`;

  try {
    const contents = history.map(msg => ({
      role: msg.isAi ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const raw = await generateWithFallback(contents, instruction, "The Council", customApiKey, isFreeTier);

    // Same defensive unwrap the simulator needs — the model sometimes fences
    // its JSON despite being told not to.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed?.imagePrompt) throw new Error('No image prompt returned');
    return {
      dialogue: parsed.dialogue || '',
      imagePrompt: String(parsed.imagePrompt),
    };
  } catch (error: any) {
    // Fall back to the user's own words rather than failing the whole request.
    return {
      dialogue: '',
      imagePrompt: userMessage,
    };
  }
}

export interface SessionSummary {
  title: string;
  covered: string[];
  takeaway: string;
  nextStep: string;
}

/**
 * A short recap of the conversation so far. Deliberately structured rather
 * than free prose — the point is something you can scan later, not another
 * message in the character's voice.
 */
export async function getSessionSummary(
  history: { text: string; isAi: boolean; character?: string }[],
  mode: string,
  customApiKey?: string | null,
  language: string = 'en'
): Promise<SessionSummary> {
  const langPrompt = language === 'hinglish' ? 'Write all strings in Hinglish (Hindi + English mix in Latin script).' :
                     language === 'hi' ? 'Write all strings in Hindi (Devanagari script).' :
                     language === 'en' ? 'Write all strings in English.' :
                     `Write all strings in ${language}.`;

  const instruction = `Summarise this conversation for the user's own records.
Return ONLY valid JSON matching this exact schema:
{
  "title": "A 3-6 word name for this session",
  "covered": ["3 to 5 short bullets of what was actually discussed"],
  "takeaway": "The single most important thing to remember. One sentence.",
  "nextStep": "One concrete thing to do next. One sentence."
}

CRITICAL RULES:
1. Do NOT wrap in markdown \`\`\`json. Return raw JSON ONLY.
2. Summarise only what is in the conversation. Invent nothing.
3. Be plain and specific. This is a record, not a pep talk.
4. ${langPrompt}`;

  const contents = history
    .filter(m => !m.text.startsWith('[System]'))
    .map(m => ({ role: m.isAi ? 'model' : 'user', parts: [{ text: m.text }] }));
  contents.push({ role: 'user', parts: [{ text: 'Summarise this session.' }] });

  const raw = await generateWithFallback(contents, instruction, "The Council", customApiKey, false);
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    title: parsed.title || 'Session summary',
    covered: Array.isArray(parsed.covered) ? parsed.covered : [],
    takeaway: parsed.takeaway || '',
    nextStep: parsed.nextStep || '',
  };
}
