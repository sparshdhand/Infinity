import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { detectCrisis } from '@/lib/crisis';
import { findSimilarGuidelines } from '@/lib/vector';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user session
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    // 2. Parse request body
    const { message, sessionId } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 3. Resolve or create Session
    let chatSession = null;
    if (sessionId) {
      chatSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (chatSession && chatSession.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!chatSession) {
      chatSession = await prisma.session.create({
        data: {
          userId,
          diagnoses: [],
          severity: 'low',
        },
      });
    }

    // Save the user message in DB
    await prisma.message.create({
      data: {
        sessionId: chatSession.id,
        role: 'user',
        content: message.trim(),
      },
    });

    // 4. Crisis Keyword Interception
    const crisisResult = detectCrisis(message);
    if (crisisResult.isCrisis) {
      let crisisResponseText = `* **Support is available**: ${crisisResult.message}\n\n`;
      if (crisisResult.helplines) {
        crisisResponseText += crisisResult.helplines
          .map(h => `* **${h.name}**: Call/Text ${h.number} - ${h.description}`)
          .join('\n\n');
      }

      // Save crisis intervention message to DB
      await prisma.message.create({
        data: {
          sessionId: chatSession.id,
          role: 'assistant',
          content: crisisResponseText,
        },
      });

      return NextResponse.json({
        sessionId: chatSession.id,
        content: crisisResponseText,
        isCrisis: true,
        helplines: crisisResult.helplines,
      });
    }

    // 5. Query matching clinical guidelines using similarity search (RAG)
    const matchedGuidelines = await findSimilarGuidelines(message, 3);
    const guidelinesText = matchedGuidelines.length > 0
      ? matchedGuidelines.map((g, idx) => `Guideline ${idx + 1}:\n${g.content}`).join('\n\n')
      : 'No clinical guidelines directly matched this query. Rely on general safe, evidence-based coping recommendations.';

    // 6. Fetch previous chat history for session context (e.g., last 10 messages)
    const dbMessages = await prisma.message.findMany({
      where: { sessionId: chatSession.id },
      orderBy: { createdAt: 'asc' },
      take: 11, // includes the user message we just inserted
    });

    // Format history for Gemini chat API (excluding the last one which is current message, and converting roles)
    const geminiHistory = dbMessages
      .slice(0, dbMessages.length - 1)
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

    // 7. Gemini API Config & Strict Bullet Prompting
    const apiKey = process.env.GEMINI_API_KEY;
    let assistantResponse = '';

    const systemInstruction = `You are a supportive, high-contrast, empathetic mental health triage assistant.
Your answers MUST strictly adhere to the following rules:

- Formulate your entire response using double-spaced bullet points only.

- Never write raw text paragraph blocks.

- Synthesize diagnostic context solely based on the provided RAG guidelines. Do not make up medical advice.

- Utilize the matched guidelines to formulate safe, calming recommendations or follow-up triage questions.

- Every single bullet point must be followed by an empty line to ensure double spacing.

- Keep the tone calming, warm, and highly structured.`;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined. Emulating bullet-point response locally.');
      assistantResponse = `* **Local Mode Active**: We received your message and searched guidelines.\n\n* **Safe Recommendation**: Based on the guidelines, consider trying the guided box breathing simulator if you are feeling overwhelmed.\n\n* **Triage Question**: Would you like to explore mindfulness strategies, or would you prefer talking to a professional?`;
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction,
      });

      const prompt = `Clinical Guidelines Context:\n${guidelinesText}\n\nUser Input: ${message}`;

      const chat = model.startChat({
        history: geminiHistory,
      });

      const result = await chat.sendMessage(prompt);
      assistantResponse = result.response.text();
    }

    // Save assistant message in DB
    await prisma.message.create({
      data: {
        sessionId: chatSession.id,
        role: 'assistant',
        content: assistantResponse,
      },
    });

    return NextResponse.json({
      sessionId: chatSession.id,
      content: assistantResponse,
      isCrisis: false,
    });
  } catch (error: any) {
    console.error('Error in chat API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
