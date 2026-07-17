import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from './prisma';

// Helper to get embedding from Gemini API
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. Returning a dummy random vector for local testing.");
    // Return a dummy 768-dimensional normalized vector
    const vector = new Array(768).fill(0).map(() => Math.random() - 0.5);
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / (magnitude || 1));
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    if (result && result.embedding && result.embedding.values) {
      return result.embedding.values;
    }
    throw new Error("Empty embedding response from Gemini");
  } catch (error) {
    console.error("Error generating embedding from Gemini SDK:", error);
    throw error;
  }
}

export interface GuidelineSearchResult {
  id: string;
  content: string;
  metadata: any;
  similarity?: number;
}

/**
 * Searches clinical guidelines using cosine similarity via pgvector.
 * Automatically falls back to text-based matching if pgvector is not available or query fails.
 */
export async function findSimilarGuidelines(
  queryText: string,
  limit: number = 3
): Promise<GuidelineSearchResult[]> {
  try {
    const embedding = await getEmbedding(queryText);
    const embeddingString = `[${embedding.join(',')}]`;

    // Perform cosine distance lookup (1 - cosine_distance = cosine_similarity)
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, content, metadata, 1 - (embedding <=> $1::vector) AS similarity 
       FROM "Guideline" 
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector 
       LIMIT $2`,
      embeddingString,
      limit
    );

    return results.map(r => ({
      id: r.id,
      content: r.content,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      similarity: Number(r.similarity),
    }));
  } catch (error) {
    console.warn(
      "Pgvector query failed (extension might not be loaded or local db lacks pgvector). Falling back to basic content search.",
      error
    );

    // Fallback: simple text scanning using Prisma client
    try {
      const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const guidelines = await prisma.guideline.findMany({
        take: 20,
      });

      const matched = guidelines.map(g => {
        let score = 0;
        const contentLower = g.content.toLowerCase();
        for (const word of words) {
          if (contentLower.includes(word)) {
            score += 1;
          }
        }
        // Normalize fake similarity score between 0.1 and 0.95
        const similarity = score > 0 ? Math.min(0.5 + (score / (words.length + 1)) * 0.45, 0.95) : 0.1;
        return {
          id: g.id,
          content: g.content,
          metadata: g.metadata,
          similarity,
        };
      });

      return matched
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, limit);
    } catch (fallbackError) {
      console.error("Fallback search failed:", fallbackError);
      return [];
    }
  }
}
