import { GoogleGenAI } from "@google/genai";
import { profilePrompt, rosterPrompt } from './characterProfiles';
import { memoryPrompt, learnFrom } from '../utils/userMemory';
import { auth } from '../firebase';
import { cooldownFor } from './cooldown';
import { GROQ, FALLBACKS } from './providers';
import { threadsPrompt, type PastThread } from './threads';
import { councilPrompt, scopeToCouncil, type Council } from './councils';
export type { PastThread } from './threads';

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

/**
 * The Groq model used when the user has pasted their own gsk_ key.
 *
 * Kept in step with GROQ_MODEL in api/generate.ts, which serves the same
 * fallback for everyone else. `llama3-70b-8192` sat here until it had been
 * decommissioned for a year without anyone noticing, because the only symptom
 * was the fallback quietly failing at the moment the Gemini quota ran out —
 * exactly when nothing else was left to answer.
 */
const GROQ_MODEL = (import.meta as any).env?.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';

/**
 * The headers for a call to our own proxy, carrying who is asking.
 *
 * /api/generate spends a shared quota, so it has to know the request came from
 * someone signed in rather than from anyone who read the url out of the bundle.
 * The token is Firebase's own, short-lived, and verified there against Google's
 * public keys.
 *
 * getIdToken() returns the cached one until it is close to expiring, so this is
 * not a round trip per message. A failure is swallowed: the server decides what
 * to do with a request that has no token, and that decision should not be
 * pre-empted here by refusing to send the message at all.
 */
async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  return headers;
}

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

/**
 * Categories the character rooms ask to be judged less tightly on.
 *
 * Council, Mentor and Poets are written to be blunt, amoral and dark — that is
 * the whole point of Tywin Lannister or a Jaun Elia couplet. On the default
 * setting the model sands that off, and every character starts hedging and
 * adding caveats, which is what "everything is censored now" means. ONLY_HIGH
 * still blocks genuinely severe content; it just stops ordinary hard-edged
 * fiction from being treated as if it were.
 *
 * The Psychologist is deliberately left on the defaults. That room is where
 * someone in a bad state actually turns up.
 */
const RELAXED_SAFETY = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' })) as any[];

/**
 * Puts the sources underneath the answer, as links.
 *
 * Appended to the text rather than carried beside it: the markdown renderer
 * already draws links, the whole thing is one string so every caller and the
 * stored history keep working untouched, and a reply read back out of history
 * still shows where it came from.
 */
/**
 * Who is allowed to look things up, and who is allowed to show their working.
 *
 * These were one switch, and the switch was the Teacher alone — because a
 * footnote under Tywin Lannister is not a Tywin Lannister line. But the thing
 * that was actually wrong with a character citing Wikipedia was the citing,
 * not the looking. The room that advises you on a decision was giving that
 * advice out of a training cut-off, with no idea what the market did last
 * month.
 *
 * So searching and citing come apart. 'cite' is the Teacher: look it up and
 * show where it came from, because a student revising from an invented date
 * finds out in an exam. 'quiet' is the Council and the Mentor: look it up,
 * know the thing, say it in your own voice and never produce a link. The poet
 * and the Psychologist stay out of it — neither room is improved by facts
 * arriving from outside it.
 *
 * Grounding is offered, not forced: the model searches when the question needs
 * it, so an ordinary conversation costs nothing extra.
 */
type Grounding = 'cite' | 'quiet' | false;

function withSources(text: string, sources?: { title: string; uri: string }[]): string {
  if (!sources?.length) return text;
  const seen = new Set<string>();
  const links = sources
    .filter(s => !seen.has(s.uri) && seen.add(s.uri))
    .slice(0, 5)
    .map(s => `[${s.title.replace(/[\[\]]/g, '')}](${s.uri})`);
  return `${text}\n\n---\n*Sources:* ${links.join(' · ')}`;
}

async function generateOnce(
  modelName: string,
  contents: any[],
  systemInstruction: string,
  customApiKey?: string | null,
  relaxSafety = false,
  grounded: Grounding = false,
): Promise<string> {
  const own = ownGeminiKey(customApiKey);

  if (own) {
    const response = await clientFor(own).models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        ...(relaxSafety ? { safetySettings: RELAXED_SAFETY } : {}),
        ...(grounded ? { tools: [{ googleSearch: {} }] } : {}),
      },
    });
    const chunks = (response as any)?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const own_sources = chunks
      .map((c: any) => c?.web)
      .filter((w: any) => w?.uri)
      .map((w: any) => ({ title: String(w.title || w.uri), uri: String(w.uri) }));
    return withSources(response.text || "Silence.", grounded === 'cite' ? own_sources : undefined);
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: await apiHeaders(),
    body: JSON.stringify({ provider: 'gemini', model: modelName, contents, systemInstruction, relaxSafety, grounded }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `${res.status}`);
  return withSources(data?.text || "Silence.", grounded === 'cite' ? data?.sources : undefined);
}



/**
 * How much conversation Groq is sent.
 *
 * Its free tier allows 8,000 tokens a minute — generous in requests, tight in
 * tokens — and the budget everywhere else is 240,000 characters, which is about
 * sixty thousand tokens. One ordinary message would be seven times the entire
 * minute's allowance and simply fail.
 *
 * So the thread is cut to its most recent part before it goes there. Eight
 * thousand characters is roughly two thousand tokens, which leaves room for
 * the instruction and the reply inside the limit. It is less memory than Gemini
 * gets; it is also the difference between a shorter answer and no answer.
 *
 * Every provider in FALLBACKS gets the same cut, not only Groq. Most of them
 * allow more, but the budget is set by the tightest one in the list, and a
 * thread trimmed the same way everywhere means the answer does not change
 * character depending on which bucket happened to have room today.
 */
const GROQ_BUDGET = 8_000;

function trimForFallback(contents: any[]): any[] {
  const out: any[] = [];
  let used = 0;
  for (let i = contents.length - 1; i >= 0; i--) {
    const size = (contents[i]?.parts?.[0]?.text || '').length;
    if (used + size > GROQ_BUDGET && out.length >= 2) break;
    out.unshift(contents[i]);
    used += size;
  }
  // A conversation that starts on a model turn is rejected; drop it.
  while (out.length && out[0]?.role === 'model') out.shift();
  return out.length ? out : contents.slice(-1);
}

const exhaustedModels: Record<string, number> = {};

/**
 * Which key the cooldowns below belong to.
 *
 * A model is marked exhausted because a quota ran out — and a quota belongs to
 * a key, not to a model. Both caches were keyed by model name alone, so
 * pasting a fresh key after hitting the limit changed nothing: every model was
 * still on a ten-minute cooldown earned by the old one, the chain skipped all
 * of them, and the new key with its untouched quota was never tried. The key
 * appeared not to work. It had not been used.
 *
 * So a change of key clears them. The new one starts with everything available
 * to it, which is the truth about it.
 */
let cooldownKey: string | null | undefined;

function resetCooldownsIfKeyChanged(customApiKey?: string | null) {
  const now = customApiKey || null;
  if (now === cooldownKey) return;
  cooldownKey = now;
  for (const k of Object.keys(exhaustedModels)) delete exhaustedModels[k];
  deadModels.clear();
}



/**
 * Models that answered 404 — retired by Google, and never coming back within
 * this session. Without this a retired name was retried on every single
 * message, which is a wasted round trip per reply, forever.
 */
const deadModels = new Set<string>();

async function generateViaProvider(
  provider: string,
  contents: any[],
  systemInstruction: string,
  errorPrefix: string,
  customApiKey?: string | null
): Promise<string> {
  // A gsk_ key came from the user's own Settings, so it is used directly, and
  // only Groq takes one. Everything else goes through the proxy, where the
  // server holds the key.
  const ownGroqKey = provider === GROQ && customApiKey?.trim().startsWith('gsk_')
    ? customApiKey.trim()
    : null;

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
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7 }),
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
      headers: await apiHeaders(),
      body: JSON.stringify({ provider, contents, systemInstruction }),
    });

    const data = await res.json().catch(() => ({} as any));

    // 503 means this provider has no key on the server. It used to end the
    // whole chain with "exhausted across all tiers", which was true when there
    // was one fallback and is a lie now that there are seven: an unconfigured
    // provider in position two would have closed the door on five working ones
    // behind it. It is an ordinary error, the loop moves on, and the loop's own
    // ending speaks for all of them once they have all actually been tried.
    if (res.status === 503) {
      throw new Error(data?.error || `${errorPrefix}: not configured`);
    }
    if (!res.ok) throw new Error(data?.error || `${res.status}`);
    return data?.text || "Silence.";
  } catch (error: any) {
    if (error?.message?.startsWith('[System Error]')) throw error;
    // Named, so the loop's warning says which one went and the next is tried.
    console.warn(`${provider} failed:`, error?.message || error);
    throw new Error(`${provider}: ${error?.message || 'Unknown error'}`);
  }
}

async function generateWithFallback(
  contents: any[],
  systemInstruction: string,
  errorPrefix: string,
  customApiKey?: string | null,
  fastMode: boolean = true,
  relaxSafety = false,
  grounded: Grounding = false,
  leanInstruction?: string,
): Promise<string> {
  const retry = async <T>(fn: () => Promise<T>): Promise<T> => {
    return await fn();
  };

  resetCooldownsIfKeyChanged(customApiKey);

  let lastError: any;

  /**
   * The order matters more than it looks: every name that fails costs a full
   * round trip before the real answer is even requested.
   *
   * gemini-2.5-pro is gone — it now 404s for this key — and it used to sit
   * second in both lists, so every reply in the app paid for it. Every name
   * below was checked against the live endpoint.
   */
  const modelsToTry = fastMode ? [
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-3.1-pro-preview",
    ...FALLBACKS,
  ] : [
    // Pro is the better answer when the quota allows it, but it is also the
    // first to run out, so the flash models sit behind it rather than the
    // other way round.
    "gemini-3.1-pro-preview",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash",
    ...FALLBACKS,
  ];

  /**
   * What went wrong, rather than what went wrong last.
   *
   * The loop kept only `lastError`, and the last thing tried is the least
   * informative thing in the chain — the final fallback, which on most
   * deployments has no key. So a spent Gemini quota was reported as
   * "Cloudflare Workers AI is not configured", which is true, irrelevant, and
   * tells the person nothing they can act on.
   */
  let sawQuota = false;
  let attempted = 0;
  const unconfigured: string[] = [];

  for (const modelName of modelsToTry) {
    if (deadModels.has(modelName)) continue;
    if (exhaustedModels[modelName] && Date.now() < exhaustedModels[modelName]) {
      console.log(`Skipping ${modelName} (on cooldown due to recent quota exhaustion).`);
      continue;
    }

    attempted++;
    try {
      const text = FALLBACKS.includes(modelName)
        ? await generateViaProvider(modelName, trimForFallback(contents), leanInstruction || systemInstruction, errorPrefix, customApiKey)
        : await retry(() => generateOnce(modelName, contents, systemInstruction, customApiKey, relaxSafety, grounded));
      return text;
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || "";
      
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
        sawQuota = true;
        const wait = cooldownFor(errorMessage);
        console.warn(`Quota exceeded for ${modelName}. Benching it for ${Math.round(wait / 1000)}s and falling back to the next model...`);
        exhaustedModels[modelName] = Date.now() + wait;
        continue;
      }

      if (errorMessage.includes('503') || errorMessage.includes('high demand') || errorMessage.includes('overloaded')) {
        console.warn(`High demand for ${modelName}. Falling back to next model...`);
        continue;
      }
      
      /**
       * Not signed in is not an outage, and it is not worth twelve attempts.
       *
       * The endpoint refuses an unverified caller, so every model and every
       * provider refuses identically — and the chain dutifully asked all of
       * them before reporting the last one's words: "The connection is
       * temporarily severed. (cloudflare: Sign in to use this.)" Twelve
       * round trips to be told something the first one knew, phrased as a
       * network fault and attributed to whichever provider happened to be
       * last in the list.
       */
      if (errorMessage.includes('Sign in to use this') || errorMessage.includes('401')) {
        return `[System Error] You are signed out. Sign in again and the room will answer.`;
      }

      if (errorMessage.includes('not configured')) {
        unconfigured.push(modelName);
        // No key for it on this deployment. Asking again would only cost
        // another round trip to our own server, every message, forever.
        console.warn(`${modelName} has no key here. Dropping it for this session.`);
        deadModels.add(modelName);
        continue;
      }

      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        // Retired, not busy. Asking again later would only cost another round
        // trip, so it is out for the rest of the session.
        console.warn(`Model ${modelName} is gone. Dropping it for this session.`);
        deadModels.add(modelName);
        continue;
      }

      console.warn(`Unexpected error with ${modelName}:`, errorMessage);
      continue;
    }
  }

  console.error("All models failed or fatal error:", lastError);
  const finalErrorMessage = lastError?.message || "";
  
  // Every fallback is in the chain above, so by this point all of them have
  // been tried. The fallback used to be called only when the LAST model
  // happened to fail with a 429 — so four models exhausting their quota and a
  // fifth answering 503 produced "overwhelmed across all tiers" while the
  // untouched fallback sat there. That sentence was true about a tier it never
  // reached. It is only allowed to be said down here, where it is earned.
  if (sawQuota) {
    /**
     * Say when, because the model told us.
     *
     * Google's refusal carries how long to wait, and the chain has already
     * parsed it to decide how long to bench each name. The soonest of those
     * is the soonest this can work again, and it is the only thing a person
     * reading this actually wants to know.
     */
    const soonest = modelsToTry
      .map(m => exhaustedModels[m])
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    const mins = soonest ? Math.max(1, Math.round((soonest - Date.now()) / 60_000)) : 0;
    const when = !mins ? ''
      : mins < 90 ? ` Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`
      : ` The day's allowance resets after midnight in California.`;
    const spare = unconfigured.length
      ? ` ${unconfigured.length} spare provider${unconfigured.length === 1 ? ' has' : 's have'} no key on this deployment — adding one would have answered this.`
      : '';
    return `[System Error] Today's free quota is gone on every model this key can reach.${when}${spare}`;
  }

  // Only when every single thing tried was "no key here". Anything else in
  // the mix means something real failed and that is the news.
  if (attempted > 0 && unconfigured.length === attempted) {
    return `[System Error] Nothing on this deployment is configured to answer. Add a provider key.`;
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

/**
 * Read the whole thing.
 *
 * Every room already knew its own length — the Teacher's follows the question,
 * the Psychologist's follows what was brought, the poet's follows the feeling.
 * None of them said the other half: that a long message has to be answered in
 * full. Given five hundred words of a situation, the model took the first
 * thread it found interesting, answered that, and let the rest go unmentioned.
 * To someone who had just spent ten minutes writing it out, that reads as not
 * having been read at all.
 *
 * It sits outside the rooms because it is true in all five, and after them
 * because where it meets an older instruction to be brief, this one wins.
 */
const wholeMessageRule = `

WHAT THEY SENT YOU
- Read all of it before you answer any of it. If they wrote four paragraphs, four paragraphs are what you are answering — not the first interesting line in them.
- Nothing they gave you goes unacknowledged. A name, a number, a detail in the middle, the thing they mentioned once and moved past: if it was worth their typing, it is worth your noticing. You may refuse to treat it all as equally important — say which part actually matters and call the rest noise — but you may not quietly skip it.
- Length follows what they sent. A line gets a line. A page earns the room to answer a page, and that is not permission to pad, to list, or to recite their own situation back to them.
- If they asked several things, answer several things. Answering one and falling silent on the rest is the most common way to leave someone feeling unheard.
- Where the reply is verse, this is satisfied by holding all of it, not by enumerating it. A poem that covers everything by listing it has stopped being a poem.`;


export async function getInnerVoiceResponse(
  userMessage: string,
  mode: 'COUNCIL' | 'MENTOR' | 'EMOTION' | 'TEACHER' | 'PSYCHOLOGY', 
  character?: string,
  history: { text: string; isAi: boolean; character?: string }[] = [],
  customApiKey?: string | null,
  language: string = 'en',
  isFreeTier: boolean = false,
  attachments: Attachment[] = [],
  pastThreads: PastThread[] = [],
  /** A council the person assembled. Absent means the whole house. */
  council?: Council,
): Promise<string> {
  const langPrompt = language === 'hinglish' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hinglish (a natural mix of Hindi and English written in Latin script). Do NOT respond in pure English.' :
                     language === 'hi' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in Hindi (using Devanagari script). Do NOT respond in English.' :
                     language === 'en' ? 'CRITICAL PRIORITY: You MUST respond ENTIRELY in English.' : 
                     `CRITICAL PRIORITY: You MUST respond ENTIRELY in ${language}.`;
  
  /**
   * Council and Mentor only. Teacher, Psychologist and Poets each carry their
   * own rules, because what makes a good tutor is not what makes Tywin
   * Lannister.
   *
   * This is deliberately back to what it was. A formatting section was added
   * here — bold lead lines, ### subheadings, bullets, a takeaway at the end —
   * and it flattened every character into the same briefing document. Shelby
   * does not answer in bullet points. The whole value of these two rooms is
   * that each voice sounds like itself, and a layout rule applied to all of
   * them destroys exactly that. Structure belongs in Teacher, where someone is
   * being taught something; it does not belong here.
   */
  /**
   * The Council speaks with these voices — the same roster the Mentor offers.
   *
   * The five at the end sold things for a living. They are here because the
   * question people actually bring — how do I get anyone to care about this —
   * was being answered by strategists and soldiers, who are superb on whether
   * to move and useless on what to say when you do.
   */
  const COUNCIL_ROSTER = [
    'Thomas Shelby', 'Tywin Lannister', 'Petyr Baelish', 'Cersei Lannister', 'Tyrion Lannister',
    'Madara Uchiha', 'Itachi Uchiha', 'Pain', 'Shikamaru Nara', 'Johan Liebert',
    'Kiyotaka Ayanokoji', 'L (Death Note)', 'Patrick Jane (The Mentalist)', 'Sosuke Aizen (Bleach)', 'Senku Ishigami (Dr. Stone)',
    'Chanakya (चाणक्य)', 'Sun Tzu (The Art of War)', 'Niccolò Machiavelli',
    'Harvey Specter (Suits)', 'Gustavo Fring (Breaking Bad)',
    'David Ogilvy', 'Claude Hopkins (Scientific Advertising)', 'Eugene Schwartz (Breakthrough Advertising)',
    'Gary Halbert (The Boron Letters)', 'Bill Bernbach (DDB)',
  ];

  const corePersonaRules = `
CORE RULES:
- You are not an AI assistant. You are a REAL personality with ideology, ego, flaws, and emotions.
- NEVER feel like ChatGPT, customer support, or generic AI. The goal is NOT to help politely. The goal is to feel REAL.
- Speak naturally. Use short sentences, pauses, silence, and emotional weight.
- Avoid robotic structures, overexplaining, and corporate safety.
- NEVER use headings, bullet points, numbered lists, or bold "key takeaway" lines. You are talking, not briefing. If a thought has parts, say them the way a person would.
- NEVER say: "As an AI", "I understand", "I recommend", "Stay positive", or use motivational garbage.
- Responses must be cinematic, emotionally sharp, psychologically accurate, and impactful. Short by default — but the default bends to what they sent you.
- Sometimes be uncomfortable, cold, sarcastic, or irritated if the user is being stupid.
- Do NOT pad. An essay where one line would do is a failure of nerve. One line where they wrote five hundred words is worse.
- You are allowed to challenge the user and disagree.

WHEN THEY ASK YOU TO TEACH THEM
- This is the one place the rules above bend, and they bend because someone asked. If they want to learn how you do what you do — read a room, run a negotiation, see what a face is doing, think four moves out — then teach it. Properly. Do not deflect it with a joke, do not say it cannot be taught, do not give them a mood where they asked for a method.
- Teach the way a master teaches an apprentice who is worth the time: the actual mechanics. What you look at first and why that and not the obvious thing. What the tell is. What people get wrong when they try it. A worked example from something you have actually done. Then one thing for them to go and practise.
- Here you may take the length it needs, and you may use structure — steps, a sequence, a short list — because a method has parts and hiding them is not style, it is withholding. Everywhere else the no-structure rule stands.
- Stay yourself while you do it. You are not a textbook that learned your name; you are this person, in a good mood, explaining the thing you are best at to someone who finally asked the right question. Your opinions, your impatience and your contempt for the easy version all survive the lesson.
- Give them the real thing, not the safe summary of it. A watered-down answer from you is worse than silence, because they will believe it.

WHAT YOU CAN FIND OUT
- You can look things up, and you should when the answer turns on something you would not otherwise know: what a market did this quarter, what a company announced, what a thing costs now. Check rather than guess, and check before you contradict them.
- Do it silently. Never say you searched, never produce a link, never list sources, never hedge with "as of my information". You simply know, the way a person who stays informed knows, and you say it like one.
- If what you find contradicts what they believe, tell them straight. That is half of what they came for.

- Do not soften, hedge, moralise, or add disclaimers. These characters are ruthless, amoral and self-interested by design — write them that way. No warnings about their advice, no "but of course" caveats, no stepping outside the character to be responsible.
- ${langPrompt} You must maintain the personality, emotional depth, realism, and cinematic tone in EVERY language. Never translate mechanically. Adapt emotionally avoiding robotic AI tones.`;

  // A made council seats only the people it was given. Two is a room; one is
  // a mentor with extra steps, so a council that thin falls back to the house.
  const seated = council && council.members.length >= 2 ? council.members : COUNCIL_ROSTER;

  const councilInstructionFor = (rosterSize: number | undefined, withRoom: boolean) => `You are a room of ruthless, highly intelligent people who meet about one person's problem. They are in the chair. The room argues in private; what reaches them is the answer it produced.

WHO IS IN THE ROOM
${rosterPrompt(seated, rosterSize)}

WHAT THEY SEE
- One answer, from one of them, in his voice. Not a transcript, not a panel, not three headings to read through. They came with a problem, not to chair a meeting.
- Open with '[Name]' so they know who is talking, then talk. Short — this is the conclusion, not the deliberation. Four or five sentences is usually the whole of it, when what they sent was ordinary. When they have written a page, the answer takes the room that page needs.
- The argument should be audible underneath it without being reproduced. "Tywin would have you wait. He can afford to." One line acknowledging where the room split is worth more than the split itself.
- Say the thing. The room already disagreed in private; out here somebody takes a position and stands on it.

WHEN THE ROOM IS NOT NEEDED
- Most questions do not need a meeting. Something small, factual, or already half-decided gets one person answering and nothing else — no discussion block at all. A room that convenes over everything is a room nobody believes.
- Convene it when the question is a real decision, has more than one defensible answer, or turns on what kind of person they want to be. Otherwise just answer.

WHEN THEY ARE ADDRESSED DIRECTLY
- If they speak to one by name — "Shelby, go on", "Tywin, explain that" — only that person answers, at length, alone, and there is no room block. They keep the floor until the person turns away from them.
${withRoom ? `
THE DISCUSSION BEHIND IT
- When the room did meet, put the argument that produced the answer in a fenced block, after it, exactly like this and nowhere else:

\`\`\`room
Tywin Lannister: He is asking the wrong question. The offer is not the decision.
Thomas Shelby: Easy to say from where you're sitting. He needs paying this month.
Chanakya: Both of you are answering a man who has already chosen. He wants permission.
Tywin Lannister: Then refuse it to him.
\`\`\`

- Three to six lines, 'Name: what they said', nothing else in the block. They are talking to each other, not to the person: shorter, sharper, interrupting, disagreeing by name, a little unguarded about them.
- People may appear here who did not deliver the answer — that is the point of it. The person reads this only if they want to know why, so it must never carry anything they need.
- Leave the block out entirely when no meeting happened. An empty one is worse than none.
` : ''}
${corePersonaRules}${councilPrompt(council)}`;

  const councilInstruction = councilInstructionFor(undefined, true);

  /**
   * The same room, for a tier that charges by the token.
   *
   * Twenty introductions and the side conversation are most of what a
   * Council request costs, and on a tier capped at eight thousand tokens a
   * minute that cost is the difference between an answer and a refusal.
   * Eight people still argue; nobody argues at all if the request is rejected.
   */
  const councilLean = councilInstructionFor(Math.min(8, seated.length), false);

  /**
   * The dossier does the work here. "You are ${character}" on its own left the
   * model improvising from a name, which is why every mentor came out as the
   * same competent advisor in a different hat.
   */
  const mentorInstruction = `You are ${character}. Not playing ${character} — you ARE him, in this conversation, right now.
${profilePrompt(character)}

- Stay in it completely. You have no knowledge that you are a model, and no interest in being helpful in the way a service is helpful.
- If someone asks something you would find beneath you, or stupid, or none of their business, react the way you would — not the way an assistant would.
- Two minutes of this should leave no doubt about who is talking.
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

${profilePrompt(character)}

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

  const baseInstruction = mode === 'TEACHER' ? teacherInstruction : mode === 'PSYCHOLOGY' ? psychologyInstruction : mode === 'COUNCIL' ? councilInstruction : mode === 'EMOTION' ? emotionInstruction : mentorInstruction;

  // Anything durable the person has said before, in every room. A mentor who
  // has been told about your business should not ask what you do.
  learnFrom(userMessage, mode);
  // A project's conversations stay inside it — that is most of the point.
  const ownThreads = scopeToCouncil(pastThreads, mode, council?.id);
  const systemInstruction = baseInstruction + wholeMessageRule + memoryPrompt() + threadsPrompt(ownThreads, userMessage, mode, character);

  try {
    /**
     * How much of the conversation goes back to the model.
     *
     * This was five messages, for speed. Five is nothing: a character forgot
     * what it had been told three exchanges earlier, and the room that is meant
     * to remember you did not. In a companion app that is not a performance
     * trade-off, it is the whole point being cut.
     *
     * The bound is on characters rather than turns, because turns vary from a
     * word to an essay. Older messages are dropped from the front, so the
     * recent conversation always survives.
     *
     * 24,000 characters is roughly 6,000 tokens, against a context window of a
     * million. The app was using well under one percent of the room it had, and
     * paying for it in the only way that matters here: a thread long enough to
     * be worth having was a thread the model had started forgetting.
     *
     * The ceiling costs nothing extra in the quota that actually binds, which
     * is counted in requests rather than tokens — a longer prompt is the same
     * one request. It is set at a tenth of the window rather than all of it so
     * there is room for an attachment on the final turn, and so a very long
     * thread degrades by dropping its oldest messages rather than by failing.
     *
     * If threads ever run past this, the next step is to roll what falls off
     * into a running summary rather than raise the number again —
     * getSessionSummary already writes exactly that.
     */
    const HISTORY_BUDGET = 240_000;
    const recentHistory: typeof history = [];
    let used = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const size = (history[i]?.text || '').length;
      if (used + size > HISTORY_BUDGET && recentHistory.length >= 6) break;
      recentHistory.unshift(history[i]);
      used += size;
    }
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

    // The character rooms only. The Psychologist keeps the default filter.
    const relaxSafety = mode === 'COUNCIL' || mode === 'MENTOR' || mode === 'EMOTION';

    // Who may look, and who may show their working. See `Grounding`.
    const grounded: Grounding =
      mode === 'TEACHER' ? 'cite'
      : mode === 'COUNCIL' || mode === 'MENTOR' ? 'quiet'
      : false;

    return await generateWithFallback(contents, systemInstruction, mode === 'TEACHER' ? "The Professor" : mode === 'PSYCHOLOGY' ? "The Psychologist" : mode === 'EMOTION' ? "The Council of Emotions" : "The Council", customApiKey, isFreeTier, relaxSafety, grounded,
      // The Council is the only room big enough to need a smaller version of
      // itself; the others already fit.
      mode === 'COUNCIL' ? councilLean + wholeMessageRule + memoryPrompt() + threadsPrompt(ownThreads, userMessage, mode, character) : undefined);
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
