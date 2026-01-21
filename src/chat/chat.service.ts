import { Injectable, HttpException, HttpStatus, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, ChatResponseDto, SupportedLanguage } from './dto/chat.dto';

interface LanguageConfig {
  name: string;
  nativeName: string;
  tutorDescription: string;
  pronunciationSystem: string;
  pronunciationExample: string;
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
    pronunciationExample: '/ɡreɪt ˈɛfərt!/',
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
    pronunciationExample: 'すꜛごꜜい (sugoi)',
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
    pronunciationExample: '잘했어요 (jalhaesseoyo)',
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
    pronunciationExample: 'hěn bàng! (很棒!)',
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
    pronunciationExample: '/tʁɛ bjɛ̃/ (très bien)',
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
    pronunciationExample: '/zeːɐ̯ guːt/ (sehr gut)',
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
    pronunciationExample: '/ˈmui ˈbjen/ (muy bien)',
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

// List of Gemini models to try in order (fallback mechanism)
const GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;
  private currentModelIndex = 0;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not defined in environment variables');
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('Gemini AI client initialized successfully');
  }

  private getSystemPrompt(language: SupportedLanguage): string {
    const config = LANGUAGE_CONFIGS[language];
    
    const specialRulesText = config.specialRules
      .map((rule, index) => `${index + 8}. ${rule}`)
      .join('\n');

    return `You are ${config.tutorDescription}. Your role is to help students improve their ${config.name} (${config.nativeName}) speaking skills.

When a student speaks, you must respond in a structured JSON format with the following fields:
- original: The original text the student said (exactly as they said it)
- correction: The corrected version if there are any grammar, pronunciation, or vocabulary mistakes
- correctionPronunciation: ${config.pronunciationSystem} transcription of the CORRECTED sentence (this helps students practice the correct pronunciation)
- explanation: A brief, friendly explanation of the correction (if any mistakes were found) - respond in ${config.name}
- reply: Your natural, conversational reply as a tutor in ${config.name} (encourage the student, ask follow-up questions, or provide feedback)
- pronunciation: ${config.pronunciationSystem} transcription of your reply

IMPORTANT RULES:
1. Always return valid JSON only, no additional text before or after
2. If the student's ${config.name} is perfect, set "correction" to the same as "original" and "correctionPronunciation" to the pronunciation of the original
3. Be encouraging and friendly in your "reply" - always respond in ${config.name}
4. Focus on natural conversation flow in ${config.name}
5. If the student makes multiple mistakes, correct the most important ones
6. For pronunciation fields, always use ${config.pronunciationSystem}
7. The "correctionPronunciation" field is REQUIRED - it helps students practice saying the sentence correctly
${specialRulesText}

Example response format:
{
  "original": "${config.exampleOriginal}",
  "correction": "${config.exampleCorrection}",
  "correctionPronunciation": "${config.exampleCorrectionPronunciation}",
  "explanation": "${config.exampleExplanation}",
  "reply": "${config.exampleReply}",
  "pronunciation": "${config.examplePronunciation}"
}`;
  }

  private isRateLimitError(error: Error): boolean {
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('429') ||
      message.includes('too many requests') ||
      message.includes('resource exhausted') ||
      message.includes('quota') ||
      message.includes('rate limit')
    );
  }

  private async generateWithFallback(prompt: string): Promise<string> {
    const startIndex = this.currentModelIndex;
    let lastError: Error | null = null;

    // Try each model starting from current index
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const modelIndex = (startIndex + i) % GEMINI_MODELS.length;
      const modelName = GEMINI_MODELS[modelIndex];

      try {
        this.logger.log(`Trying model: ${modelName}`);
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Success! Update current model index for next request
        this.currentModelIndex = modelIndex;
        this.logger.log(`Successfully got response from model: ${modelName}`);
        return text;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Model ${modelName} failed: ${error.message}`);

        if (this.isRateLimitError(error)) {
          // Move to next model
          this.logger.log(`Rate limit hit on ${modelName}, trying next model...`);
          continue;
        }

        // For non-rate-limit errors, throw immediately
        throw error;
      }
    }

    // All models failed
    this.logger.error('All Gemini models exhausted');
    throw lastError || new Error('All Gemini models are unavailable');
  }

  async sendMessage(
    userMessage: string,
    chatHistory: ChatMessage[] = [],
    targetLanguage: SupportedLanguage = 'english',
  ): Promise<ChatResponseDto> {
    try {
      const systemPrompt = this.getSystemPrompt(targetLanguage);

      // Build conversation history context
      const recentHistory = chatHistory.slice(-10);
      const historyContext =
        recentHistory.length > 0
          ? recentHistory
              .map((msg) => {
                if (msg.role === 'user') {
                  return `Student: ${msg.content}`;
                } else if (msg.data?.reply) {
                  return `Tutor: ${msg.data.reply}`;
                }
                return '';
              })
              .filter(Boolean)
              .join('\n')
          : 'This is the start of the conversation.';

      const fullPrompt = `${systemPrompt}\n\nConversation History:\n${historyContext}\n\nStudent: ${userMessage}\n\nTutor (respond in JSON format):`;

      this.logger.debug(`Sending message to Gemini: ${userMessage.substring(0, 50)}...`);
      
      // Use fallback mechanism to get response
      const text = await this.generateWithFallback(fullPrompt);

      // Parse JSON response
      try {
        const cleanedText = text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const jsonResponse = JSON.parse(cleanedText);

        this.logger.debug('Successfully parsed Gemini response');
        
        return {
          success: true,
          data: jsonResponse,
        };
      } catch {
        // Fallback if JSON parsing fails
        this.logger.warn('Failed to parse JSON response, using fallback');
        
        return {
          success: true,
          data: {
            original: userMessage,
            correction: userMessage,
            correctionPronunciation: '',
            explanation: '',
            reply: text,
            pronunciation: '',
          },
        };
      }
    } catch (error) {
      this.logger.error(`Error calling Gemini API: ${error.message}`, error.stack);

      if (error.message?.includes('API_KEY')) {
        throw new HttpException(
          'Invalid API key configuration',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (this.isRateLimitError(error)) {
        throw new HttpException(
          'All AI models are currently rate limited. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new HttpException(
        `Failed to get AI response: ${error.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
