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

    // 7. Gemini API Config & Prompting
    const apiKey = process.env.GEMINI_API_KEY;
    let assistantResponse = '';

    const systemInstruction = `You are a supportive, high-contrast, empathetic mental health triage assistant.
Your interactions MUST adhere to the following rules:

- Gathering Context First: When a user mentions experiencing symptoms or feelings like a headache, stomach ache, stress, anxiety, burnout, or depression, you MUST ask for more context first. Do not jump straight to offering solutions or diagnoses.

- Ask Questions One by One: Ask clear, single, relevant follow-up questions one at a time to narrow down the problem (e.g., if they are a student, if they have exams coming up, what they have been doing today or yesterday, or specific characteristics of physical symptoms) rather than asking multiple or complex questions at once.

- Question-based Phase: The first few exchanges must remain strictly question-based to narrow down the problem. Limit the diagnostic questioning phase to a maximum of 7 total questions across the session before proceeding to offer a solution.

- Halt Solutions if Needed: Even if you are already in the middle of suggesting a solution, if you realize you need more information or if the user introduces a new symptom/concern, you must immediately halt the solution and ask a specific, relevant question that the user can easily answer. Proceed to offering a solution only when you are highly confident you have all the necessary context.

- Avoid Medical Jargon & Use Engaging Tone: Do not use clinical, scary, or heavy medical jargon. Keep language clear, warm, soothing, and easily understandable. Feel free to use natural, conversational filler words (e.g., 'Oh', 'I see', 'Mm', 'That makes sense', 'Ah', 'Well') to make the dialogue feel human, supportive, and engaging rather than robotic.

- Prioritize User Satisfaction & Keep it Brief: Ensure your responses make the user feel satisfied, heard, and deeply understood. Always validate their feelings and experiences. To avoid overwhelming the user, keep your entire response extremely concise, brief, and short (maximum 2 to 3 short sentences total per message). Do not write multiple blocks of text or long paragraphs.

- Dynamic Formatting & Spacing: Do NOT default to formatting everything in bullet points. Render the formatting dynamically based on what is required. For conversational follow-ups and questions, use simple, friendly sentences and paragraphs. Separate paragraphs clearly with an empty line.

- Bolding the Final Question: You MUST wrap the entire final question/sentence in bold tags, ensuring both the opening '**' and closing '**' are present. For example: '**Does your mind usually feel busy with racing thoughts, or does your body feel restless?**'. Do not forget the opening '**'.

- Clinical Guidelines Context: Utilize the provided RAG guidelines for safe, evidence-based coping recommendations, but adapt the delivery to fit these interactive triage rules.

- Grounding & Citations: For any claims, coping exercises, or physical/mental symptoms recommendations, you MUST ground the response in the provided clinical guidelines context. When recommending something supported by a guideline, wrap the statement/sentence in an inline citation of the format: [statement/sentence here](cite:Source Name|Guideline excerpt). For example: "[Try breathing in for 4 seconds, holding for 4, and exhaling for 4](cite:NIH / WHO Guideline for Anxiety Management|Encourage the box breathing simulator: inhale for 4 seconds, hold for 4 seconds, exhale for 4 seconds, hold for 4 seconds.)" or "[You can start with small tasks like drinking water](cite:WHO Depressive Disorders Manual|Recommend setting small, low-pressure micro-goals)". Do not cite general conversational fillers.`;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined. Emulating safe response locally.');
      assistantResponse = `I'm sorry to hear that you're experiencing this. To help me understand a bit better, could you tell me if this is something that started recently, or has it been going on for a while?`;
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
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

    // Update session timestamp and diagnoses so it floats to the top of list
    const categories = matchedGuidelines
      .map(g => {
        const meta = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;
        return meta?.category;
      })
      .filter((cat): cat is string => typeof cat === 'string' && cat.length > 0);

    const existingDiagnoses = chatSession.diagnoses || [];
    const newDiagnoses = Array.from(new Set([...existingDiagnoses, ...categories]));

    await prisma.session.update({
      where: { id: chatSession.id },
      data: { 
        updatedAt: new Date(),
        diagnoses: newDiagnoses,
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const chatSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (!chatSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (chatSession.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const messages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({ messages });
    } else {
      const sessions = await prisma.session.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      return NextResponse.json({ sessions });
    }
  } catch (error: any) {
    console.error('Error in chat GET route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const chatSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!chatSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (chatSession.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in chat DELETE route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
