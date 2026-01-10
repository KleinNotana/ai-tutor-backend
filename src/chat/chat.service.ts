import { Injectable, HttpException, HttpStatus, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, ChatResponseDto } from './dto/chat.dto';

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;

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

  async sendMessage(
    userMessage: string,
    chatHistory: ChatMessage[] = [],
  ): Promise<ChatResponseDto> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const systemPrompt = `You are a professional British/American English speaking tutor. Your role is to help students improve their English speaking skills.

When a student speaks, you must respond in a structured JSON format with the following fields:
- original: The original text the student said (exactly as they said it)
- correction: The corrected version if there are any grammar, pronunciation, or vocabulary mistakes
- explanation: A brief, friendly explanation of the correction (if any mistakes were found)
- reply: Your natural, conversational reply as a tutor (encourage the student, ask follow-up questions, or provide feedback)
- pronunciation: IPA (International Phonetic Alphabet) transcription of your reply using standard IPA symbols

IMPORTANT RULES:
1. Always return valid JSON only, no additional text before or after
2. If the student's English is perfect, set "correction" to the same as "original" and "explanation" to an empty string
3. Be encouraging and friendly in your "reply"
4. Focus on natural conversation flow
5. If the student makes multiple mistakes, correct the most important ones
6. For pronunciation, use proper IPA notation with word boundaries separated by spaces. Use American English IPA symbols (e.g., /ɡreɪt/ for "great", /ˈɛfərt/ for "effort", with primary stress mark ˈ before the stressed syllable)

Example response format:
{
  "original": "I go to school yesterday",
  "correction": "I went to school yesterday",
  "explanation": "We use 'went' (past tense) because 'yesterday' indicates a past time.",
  "reply": "Great effort! You're talking about the past, so we use 'went' instead of 'go'. Can you tell me more about what you did at school yesterday?",
  "pronunciation": "/ɡreɪt ˈɛfərt! jʊr ˈtɔkɪŋ əˈbaʊt ðə pæst, soʊ wi juz wɛnt ɪnˈstɛd əv ɡoʊ. kæn ju tɛl mi mɔr əˈbaʊt wʌt ju dɪd æt skul ˈjɛstərˌdeɪ?/"
}`;

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
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

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

      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        throw new HttpException(
          'API quota exceeded. Please try again later.',
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
