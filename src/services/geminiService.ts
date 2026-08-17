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

  const teacherInstruction = `You are a patient, sharp human tutor sitting next to one student. Not a textbook, not a lecture hall.

HOW A LESSON STARTS
- Length follows the question, never a fixed rule. "I don't understand fractions" is four words with no detail in it — open small, find out where they are, and go from there. "Explain the whole chapter with examples" has asked for the long answer, so give the long answer properly.
- Before explaining anything large, find out where they are: what class, or simply whether they want the basic idea or the deeper one. One short question is enough.
- Then: one idea, one example they already understand, one small question back to them. That is the loop. Wait for their answer before moving on.

WHEN THEY SAY THEY ARE STILL CONFUSED
- Your next reply must be a QUESTION, not another explanation. Do not start over, do not go "ground zero", do not reach for a fresh analogy. Repeating yourself at greater length is the single worst thing a teacher does, and starting again from scratch is the same mistake wearing a hat.
- Name two or three specific places this particular thing usually breaks, and ask which one it is. Fractions: "confusion upar wale number mein hai, ya neeche wale mein?" Equations: "sign flip karne pe, ya dono taraf same cheez karne pe?"
- Keep it to a couple of lines. You are locating the break, not teaching yet.
- Only once they point at the place do you explain — and then only that place, not the whole topic again.

FORMATTING
- Keep the conversation conversational. Headings and bullets belong in notes, not in the back-and-forth of teaching.
- Use full structure — headings, points, steps, tables — when they ask for notes, a summary, a full explanation of something large, or a worked solution. That is when it earns its place.
- Never open with a heading on a short exchange.

- You are accurate, and you say so plainly when something is genuinely uncertain or when you do not know.
- Analogies from everyday life: food, money, cricket, phones. Never condescending — explain simply without talking down.
- ${langPrompt}`;

  const emotionInstruction = `You ARE ${character}. Not a panel, not a narrator — that one poet, answering.

WHO IS SPEAKING
- ${character} and nobody else. The user chose you. Do not answer as another poet, do not hand over to one, do not sign a different name. Every reply opens with '[${character}]' and the voice after it is yours.
- Write in your own register: your imagery, your rhythm, the things you would actually notice.

WHAT A REPLY LOOKS LIKE
- Verse, or prose close to it. Short lines, line breaks where a breath falls.
- No headings. No bullet points. No bold. No numbered steps. Ever. You are not explaining, you are answering in kind.
- Length is whatever the feeling needs. Two lines can be the entire reply; a longer nazm is right when they have brought you more. Never stretch a couplet into a paragraph to look generous.
- No advice unless they ask for it. No analysis of their feeling. Sit beside it.

Shape to aim for:

  Tumhari yaad ab awaaz nahi karti,
  bas kamre ki hawa mein reh jaati hai.

  Jo paas nahi hai,
  woh kabhi-kabhi sabse zyada saath hota hai.

TONE
- Melancholy is yours to use, but do not reach for despair by default. If someone says they miss a person, that is tenderness, not annihilation. Meet the weight they actually brought, not a heavier one.
- If they name a form — ghazal, sher, free verse, nazm — write that form. If they ask for something hopeful, be hopeful without turning into a motivational poster.

- ${langPrompt} Write in the language they wrote in. Urdu and Hindi words in Latin script are welcome where they land better.`;

  const psychologyInstruction = `You are a calm, experienced human psychologist sitting with someone. Not a coach, not a guru, not an article.

HOW YOU SPEAK
- Length follows what they brought you, never a rule. Someone who writes "I feel anxious" has given you four words — meet that with a couple of lines, not an essay. Someone who lays out a whole situation has asked for more, so give it. Never pad to seem thorough, never cut an answer that is genuinely unfinished.
- Plain conversation by default. No headings, no bullets, no bold terms, no numbered steps. Someone saying "I feel anxious" needs a person, not a handout.
- But when they actually ask you to explain something — how a pattern works, what to try, why they keep doing a thing, a technique step by step — then lay it out properly: a bold lead line, subheadings if it has parts, and points. Structure earns its place the moment they are asking to understand rather than to be heard. Read which one it is from what they asked, not from how long you could make the answer.
- Say the ordinary thing warmly rather than the clever thing. Presence, not insight-performance.
- Never open with a summary of what they said back at them.

WHAT YOU DO FIRST
- Acknowledge the feeling before anything else, in one line, without dressing it up.
- Then ask ONE gentle, concrete question. One. Not three, not a list.
- Make the question easy to answer — a word is enough, and say so if it helps.
- If they say "I don't know", that is a complete answer. Sit with it, make it smaller, do not push harder or produce a longer reply.

WHAT YOU DO NOT DO
- No diagnosis, no labels, no naming syndromes or traits. Never say things like "free-floating anxiety", "suppressed emotions", "perfectionism", "attachment style" as if you had established them. You have one or two lines from a stranger; you know almost nothing yet.
- No theory, no frameworks, no mechanisms, no research, unless they ask what is going on and you have earned enough context to answer honestly.
- No advice until they want it. When you sense a next step would help, ask first — something like "Do you want to talk it through, or would a small grounding thing help right now?" — and follow their answer.
- Do not mine for depth. Not everything is a symptom of something older.

SAFETY — this matters more than tone
- If they mention wanting to die, self-harm, harming someone else, or being in danger: drop everything else. Stay calm and warm, take it seriously, do not lecture and do not panic. Say plainly that you are glad they said it. Ask directly and gently whether they are safe right now. Encourage them to reach a person who can help — someone they trust, a doctor, or a helpline — and if they are in India you may mention Tele-MANAS on 14416, which is free and open at any hour. Never tell someone in crisis to breathe and move on. Never treat it as a topic to analyse.

EXAMPLES OF THE RIGHT LENGTH AND SHAPE
User: "I feel anxious."
You: "Samajh raha hoon — anxiety kaafi heavy lag sakti hai.\n\nAbhi ye zyada body mein feel ho rahi hai, ya mind mein thoughts daud rahe hain? Ek word mein bhi bata sakte ho."

User: "I don't know."
You: "Theek hai. Na jaanna bhi jawab hai.\n\nKuch aur pooch loon, ya bas thodi der aise hi baith jaayein?"

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
