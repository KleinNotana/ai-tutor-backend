import { Injectable, HttpException, HttpStatus, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel, SchemaType, type ObjectSchema } from '@google/generative-ai';
import { ChatMessage, ChatResponseDto, SupportedLanguage } from './dto/chat.dto';

interface LanguageConfig {
  name: string;
  nativeName: string;
  tutorDescription: string;
  pronunciationSystem: string;
  exampleOriginal: string;
  exampleCorrection: string;
  exampleCorrectionPronunciation: string;
  exampleExplanation: string;
  exampleReply: string;
  examplePronunciation: string;
  specialRules: string[];
}

const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  english: {
    name: 'English',
    nativeName: 'English',
    tutorDescription: 'a professional British/American English speaking tutor',
    pronunciationSystem: 'IPA (International Phonetic Alphabet) with American English symbols',
    exampleOriginal: 'I go to school yesterday',
    exampleCorrection: 'I went to school yesterday',
    exampleCorrectionPronunciation: '/aɪ wɛnt tu skul ˈjɛstərˌdeɪ/',
    exampleExplanation: "We use 'went' (past tense) because 'yesterday' indicates a past time.",
    exampleReply: "Great effort! You're talking about the past, so we use 'went' instead of 'go'. Can you tell me more about what you did at school yesterday?",
    examplePronunciation: '/ɡreɪt ˈɛfərt! jʊr ˈtɔkɪŋ əˈbaʊt ðə pæst/',
    specialRules: [
      'Use primary stress mark ˈ before stressed syllables',
      'Focus on common pronunciation mistakes for non-native speakers',
    ],
  },
  japanese: {
    name: 'Japanese',
    nativeName: '日本語',
    tutorDescription: 'a professional Japanese language tutor (日本語の先生)',
    pronunciationSystem: 'Romaji with pitch accent markers (High: ꜛ, Low: ꜜ) and Hiragana reading',
    exampleOriginal: '昨日学校に行くました',
    exampleCorrection: '昨日学校に行きました',
    exampleCorrectionPronunciation: 'きꜛのꜜう がꜛっこꜜうに いꜛきまꜜした (kinou gakkou ni ikimashita)',
    exampleExplanation: '「行く」の過去形は「行きました」です。「行くました」は文法的に正しくありません。',
    exampleReply: 'いい調子ですね！過去形の練習をしましょう。昨日、学校で何をしましたか？',
    examplePronunciation: 'いꜛいꜜ ちょꜛうしꜜ ですꜜね (ii choushi desu ne)',
    specialRules: [
      'Pay attention to particle usage (は, が, を, に, で, etc.)',
      'Check verb conjugation forms (て形, た形, ます形)',
      'Watch for keigo (敬語) politeness levels',
      'Include both Hiragana reading and Romaji for pronunciation',
    ],
  },
  korean: {
    name: 'Korean',
    nativeName: '한국어',
    tutorDescription: 'a professional Korean language tutor (한국어 선생님)',
    pronunciationSystem: 'Revised Romanization with Hangul',
    exampleOriginal: '어제 학교에 가요',
    exampleCorrection: '어제 학교에 갔어요',
    exampleCorrectionPronunciation: '어제 학교에 갔어요 (eoje hakgyoe gasseoyo)',
    exampleExplanation: "과거를 표현할 때는 '-았/었어요'를 사용합니다. '가요'는 현재형이에요.",
    exampleReply: '잘하고 있어요! 과거형 연습을 해볼까요? 어제 학교에서 뭐 했어요?',
    examplePronunciation: '잘하고 있어요 (jalhago isseoyo)',
    specialRules: [
      'Check for proper honorific levels (존댓말/반말)',
      'Watch for particle usage (은/는, 이/가, 을/를)',
      'Pay attention to verb conjugation (past, present, future)',
      'Note pronunciation changes (연음, 경음화, etc.)',
    ],
  },
  chinese: {
    name: 'Chinese',
    nativeName: '中文',
    tutorDescription: 'a professional Mandarin Chinese tutor (中文老师)',
    pronunciationSystem: 'Pinyin with tone marks (1: ā, 2: á, 3: ǎ, 4: à)',
    exampleOriginal: '我昨天去学校了',
    exampleCorrection: '我昨天去学校了',
    exampleCorrectionPronunciation: 'wǒ zuótiān qù xuéxiào le',
    exampleExplanation: '这句话是正确的！"了"表示动作完成，用得很好。',
    exampleReply: '说得很好！你的中文在进步。昨天在学校做了什么？',
    examplePronunciation: 'shuō de hěn hǎo! nǐ de zhōngwén zài jìnbù.',
    specialRules: [
      'Always include tone marks in Pinyin',
      'Check for measure word (量词) usage',
      'Watch for aspect markers (了, 过, 着)',
      'Pay attention to word order (SVO structure)',
    ],
  },
  french: {
    name: 'French',
    nativeName: 'Français',
    tutorDescription: 'a professional French language tutor (professeur de français)',
    pronunciationSystem: 'IPA with French phonemes and liaison markers',
    exampleOriginal: 'Je suis allé à école hier',
    exampleCorrection: "Je suis allé à l'école hier",
    exampleCorrectionPronunciation: "/ʒə sɥi‿ale a lekɔl jɛʁ/",
    exampleExplanation: "On utilise l'article défini contracté \"l'\" devant \"école\" car le mot commence par une voyelle.",
    exampleReply: "Très bien ! N'oubliez pas les articles. Qu'avez-vous fait à l'école hier ?",
    examplePronunciation: "/tʁɛ bjɛ̃! nublije pa lez‿aʁtikl/",
    specialRules: [
      'Check for gender agreement (le/la, un/une)',
      'Watch for verb conjugation and tense agreement',
      'Note liaisons between words',
      'Pay attention to accent marks (é, è, ê, ë, etc.)',
    ],
  },
  german: {
    name: 'German',
    nativeName: 'Deutsch',
    tutorDescription: 'a professional German language tutor (Deutschlehrer)',
    pronunciationSystem: 'IPA with German phonemes',
    exampleOriginal: 'Ich bin gestern in die Schule gegangen',
    exampleCorrection: 'Ich bin gestern in die Schule gegangen',
    exampleCorrectionPronunciation: '/ɪç bɪn ˈɡɛstɐn ɪn diː ˈʃuːlə ɡəˈɡaŋən/',
    exampleExplanation: 'Perfekt! Der Satz ist grammatikalisch korrekt. "Gegangen" ist das Partizip II von "gehen".',
    exampleReply: 'Sehr gut! Dein Deutsch ist ausgezeichnet. Was hast du gestern in der Schule gemacht?',
    examplePronunciation: '/zeːɐ̯ guːt! daɪn dɔʏtʃ ɪst ˈaʊsɡəˌtsaɪçnət/',
    specialRules: [
      'Check for correct case usage (Nominativ, Akkusativ, Dativ, Genitiv)',
      'Watch for verb position in main and subordinate clauses',
      'Pay attention to noun gender (der, die, das)',
      'Note separable prefix verbs',
    ],
  },
  spanish: {
    name: 'Spanish',
    nativeName: 'Español',
    tutorDescription: 'a professional Spanish language tutor (profesor de español)',
    pronunciationSystem: 'IPA with Spanish phonemes',
    exampleOriginal: 'Yo fui a la escuela ayer',
    exampleCorrection: 'Ayer fui a la escuela',
    exampleCorrectionPronunciation: '/aˈʝeɾ fwi a la esˈkwela/',
    exampleExplanation: 'En español, es más natural poner el tiempo al principio. También, el pronombre "yo" es opcional porque el verbo ya indica la persona.',
    exampleReply: '¡Muy bien! Tu español está mejorando. ¿Qué hiciste en la escuela ayer?',
    examplePronunciation: '/ˈmui ˈbjen! tu espaˈɲol esˈta mexoˈɾando/',
    specialRules: [
      'Check for correct verb conjugation (especially irregular verbs)',
      'Watch for ser vs estar usage',
      'Pay attention to gender and number agreement',
      'Note the use of subjunctive mood when appropriate',
    ],
  },
};

const GEMINI_MODELS_API = 'https://generativelanguage.googleapis.com/v1beta/models';

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3-flash-preview',
];

/** Forces Gemini to return exactly these keys as strings (avoids malformed / prose-wrapped JSON). */
const TUTOR_RESPONSE_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    original: { type: SchemaType.STRING },
    correction: { type: SchemaType.STRING },
    correctionPronunciation: { type: SchemaType.STRING },
    explanation: { type: SchemaType.STRING },
    reply: { type: SchemaType.STRING },
    pronunciation: { type: SchemaType.STRING },
  },
  required: [
    'original',
    'correction',
    'correctionPronunciation',
    'explanation',
    'reply',
    'pronunciation',
  ],
};

const GENERATION_CONFIG = {
  responseMimeType: 'application/json' as const,
  responseSchema: TUTOR_RESPONSE_SCHEMA,
  temperature: 0.7,
  maxOutputTokens: 2048,
};

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

/** Extract first top-level `{ ... }` balancing braces and respecting string escapes. */
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonLenient(raw: string): Record<string, unknown> | null {
  const cleaned = stripCodeFences(raw);
  try {
    const v = JSON.parse(cleaned);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    const slice = extractFirstJsonObject(cleaned);
    if (!slice) return null;
    try {
      const v = JSON.parse(slice);
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return String(v);
}

function flattenReplyIfNestedJson(data: Record<string, unknown>): Record<string, unknown> {
  const reply = asString(data.reply).trim();
  if (!reply.startsWith('{') || !reply.includes('"reply"')) return data;
  try {
    const inner = JSON.parse(reply) as Record<string, unknown>;
    if (inner && typeof inner === 'object' && typeof inner.reply === 'string') {
      return { ...data, ...inner };
    }
  } catch {
    /* keep outer */
  }
  return data;
}

function normalizeTutorPayload(parsed: Record<string, unknown>, userMessage: string): ChatResponseDto['data'] {
  const flat = flattenReplyIfNestedJson(parsed);
  return {
    original: asString(flat.original) || userMessage,
    correction: asString(flat.correction) || userMessage,
    correctionPronunciation: asString(flat.correctionPronunciation),
    explanation: asString(flat.explanation),
    reply: asString(flat.reply),
    pronunciation: asString(flat.pronunciation),
  };
}

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;
  private apiKey: string;
  private currentModelIndex = 0;

  private readonly systemPromptCache = new Map<SupportedLanguage, string>();
  private readonly modelCache = new Map<string, GenerativeModel>();

  private cachedModels: { name: string; displayName: string; description: string }[] | null = null;
  private cacheExpiry = 0;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not defined in environment variables');
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('Gemini AI client initialized successfully');

    for (const lang of Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[]) {
      this.systemPromptCache.set(lang, this.buildSystemPrompt(lang));
    }
    this.logger.log(`Pre-cached system prompts for ${this.systemPromptCache.size} languages`);
  }

  async getAvailableModels(): Promise<{ name: string; displayName: string; description: string }[]> {
    if (this.cachedModels && Date.now() < this.cacheExpiry) {
      return this.cachedModels;
    }

    try {
      const response = await fetch(`${GEMINI_MODELS_API}?key=${this.apiKey}`);
      if (!response.ok) {
        throw new Error(`Gemini API returned ${response.status}`);
      }

      const data = await response.json();
      const models = (data.models || [])
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes('generateContent'),
        )
        .map((m: any) => ({
          name: m.name?.replace('models/', '') || '',
          displayName: m.displayName || m.name || '',
          description: m.description || '',
        }))
        .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));

      this.cachedModels = models;
      this.cacheExpiry = Date.now() + 5 * 60 * 1000;

      this.logger.log(`Fetched ${models.length} available Gemini models`);
      return models;
    } catch (error) {
      this.logger.error(`Failed to fetch models: ${error.message}`);
      throw new HttpException(
        'Failed to fetch available models from Gemini API',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getOrCreateModel(modelName: string, systemInstruction: string): GenerativeModel {
    const cacheKey = `${modelName}::${systemInstruction.length}`;
    let model = this.modelCache.get(cacheKey);
    if (!model) {
      model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: GENERATION_CONFIG,
      });
      this.modelCache.set(cacheKey, model);
    }
    return model;
  }

  private buildSystemPrompt(language: SupportedLanguage): string {
    const c = LANGUAGE_CONFIGS[language];
    const rules = c.specialRules.map((r, i) => `${i + 8}. ${r}`).join('\n');

    return `You are ${c.tutorDescription}. Help students improve their ${c.name} (${c.nativeName}) speaking skills.

Respond with JSON: {"original","correction","correctionPronunciation","explanation","reply","pronunciation"}
- original: exactly what the student said
- correction: corrected version (same as original if perfect)
- correctionPronunciation: ${c.pronunciationSystem} of the correction (REQUIRED)
- explanation: brief correction explanation in ${c.name} (empty if perfect)
- reply: conversational tutor reply in ${c.name}
- pronunciation: ${c.pronunciationSystem} of your reply

Rules:
1. Return valid JSON only
2. If perfect, set correction = original
3. Be encouraging, reply in ${c.name}
4. Keep natural conversation flow
5. Correct the most important mistakes
6. Use ${c.pronunciationSystem} for pronunciation fields
7. correctionPronunciation is REQUIRED
${rules}

Example:
{"original":"${c.exampleOriginal}","correction":"${c.exampleCorrection}","correctionPronunciation":"${c.exampleCorrectionPronunciation}","explanation":"${c.exampleExplanation}","reply":"${c.exampleReply}","pronunciation":"${c.examplePronunciation}"}`;
  }

  private getSystemPrompt(language: SupportedLanguage): string {
    return this.systemPromptCache.get(language) || this.buildSystemPrompt(language);
  }

  private isRateLimitError(error: Error): boolean {
    const msg = error.message?.toLowerCase() || '';
    return msg.includes('429') || msg.includes('too many requests') ||
      msg.includes('resource exhausted') || msg.includes('quota') || msg.includes('rate limit');
  }

  private buildChatHistory(chatHistory: ChatMessage[]): { role: string; parts: { text: string }[] }[] {
    const recent = chatHistory.slice(-10);
    const history: { role: string; parts: { text: string }[] }[] = [];

    for (const msg of recent) {
      if (msg.role === 'user') {
        history.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.data?.reply) {
        history.push({
          role: 'model',
          parts: [{ text: JSON.stringify({
            original: msg.data.original || '',
            correction: msg.data.correction || '',
            correctionPronunciation: msg.data.correctionPronunciation || '',
            explanation: msg.data.explanation || '',
            reply: msg.data.reply,
            pronunciation: msg.data.pronunciation || '',
          }) }],
        });
      }
    }

    return history;
  }

  private async generateWithFallback(
    systemPrompt: string,
    chatHistory: { role: string; parts: { text: string }[] }[],
    userMessage: string,
    specificModel?: string,
  ): Promise<string> {
    const modelsToTry: string[] = [];

    if (specificModel) {
      modelsToTry.push(specificModel);
    }

    const start = this.currentModelIndex;
    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
      const name = FALLBACK_MODELS[(start + i) % FALLBACK_MODELS.length];
      if (name !== specificModel) modelsToTry.push(name);
    }

    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        this.logger.log(`Trying model: ${modelName}`);
        const model = this.getOrCreateModel(modelName, systemPrompt);
        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(userMessage);
        const text = result.response.text();

        const fallbackIdx = FALLBACK_MODELS.indexOf(modelName);
        if (fallbackIdx !== -1) this.currentModelIndex = fallbackIdx;

        this.logger.log(`Response from ${modelName} (${text.length} chars)`);
        return text;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Model ${modelName} failed: ${error.message}`);
        if (!this.isRateLimitError(error)) throw error;
      }
    }

    this.logger.error('All Gemini models exhausted');
    throw lastError || new Error('All Gemini models are unavailable');
  }

  async sendMessage(
    userMessage: string,
    chatHistory: ChatMessage[] = [],
    targetLanguage: SupportedLanguage = 'english',
    model?: string,
  ): Promise<ChatResponseDto> {
    try {
      const systemPrompt = this.getSystemPrompt(targetLanguage);
      const history = this.buildChatHistory(chatHistory);

      this.logger.debug(`Sending: "${userMessage.substring(0, 50)}..." [${targetLanguage}, ${model || 'auto'}]`);

      const text = await this.generateWithFallback(systemPrompt, history, userMessage, model);

      const parsed = parseJsonLenient(text);
      if (parsed) {
        const data = normalizeTutorPayload(parsed, userMessage);
        if (!data.reply.trim()) {
          this.logger.warn('Parsed tutor JSON but reply was empty; using safe fallback');
          data.reply =
            'I had trouble finishing my reply. Please tap Regenerate to try again, or rephrase your message.';
        }
        return { success: true, data };
      }

      this.logger.warn('JSON parse failed after lenient extraction; using fallback (raw length=%s)', text.length);
      return {
        success: true,
        data: {
          original: userMessage,
          correction: userMessage,
          correctionPronunciation: '',
          explanation: '',
          reply:
            'I could not read the tutor response correctly. Please tap Regenerate to try again.',
          pronunciation: '',
        },
      };
    } catch (error) {
      this.logger.error(`Gemini API error: ${error.message}`, error.stack);

      if (error.message?.includes('API_KEY')) {
        throw new HttpException('Invalid API key configuration', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      if (this.isRateLimitError(error)) {
        throw new HttpException('All AI models are currently rate limited. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new HttpException(`Failed to get AI response: ${error.message || 'Unknown error'}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
