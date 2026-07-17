import { NextResponse } from 'next/server';
import { getEmbedding, findSimilarGuidelines } from '@/lib/vector';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const testText = "I feel depressed and stress";
    
    // Generate embedding
    const embedding = await getEmbedding(testText);
    
    // Find matched guidelines
    const matches = await findSimilarGuidelines(testText, 2);
    
    return NextResponse.json({
      status: 'success',
      geminiApiKeyConfigured: hasKey,
      testInput: testText,
      embeddingLength: embedding.length,
      embeddingPreview: embedding.slice(0, 5),
      matches,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
