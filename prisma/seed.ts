import { PrismaClient } from '@prisma/client';
import { getEmbedding } from '../src/lib/vector';

const prisma = new PrismaClient();

interface GuidelineData {
  content: string;
  metadata: {
    category: string;
    source: string;
    lastUpdated: string;
  };
}

const guidelines: GuidelineData[] = [
  {
    content: `Guideline for Acute Anxiety and Panic Attacks:
- Encourage the box breathing simulator: inhale for 4 seconds, hold for 4 seconds, exhale for 4 seconds, hold for 4 seconds.
- Walk through grounding techniques such as the 5-4-3-2-1 sensory method (identify 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste).
- Maintain a reassuring tone, focus on physical centering, and avoid clinical diagnostic labeling.`,
    metadata: {
      category: 'anxiety',
      source: 'NIH / WHO Guideline for Anxiety Management',
      lastUpdated: '2026-05-01'
    }
  },
  {
    content: `Guideline for Depression and Low Energy / Social Isolation:
- Advise setting small, low-pressure micro-goals (e.g., drinking a glass of water, standing by a window for 5 minutes).
- Recommend light physical activation (gentle stretching, a 5-minute walk) and small acts of social connection (texting one trusted contact).
- Remind users that healing is non-linear and that professional consultations are recommended for prolonged depressive states.`,
    metadata: {
      category: 'depression',
      source: 'WHO Depressive Disorders Manual',
      lastUpdated: '2026-04-15'
    }
  },
  {
    content: `Guideline for High Stress, Overwhelm, and Work Burnout:
- Suggest structured boundary-setting (e.g., designating strict device-free hours, disabling work notifications).
- Emphasize the importance of micro-breaks (e.g., the Pomodoro technique or stepping away every 50 minutes).
- Advise focusing on active recovery activities (nature walks, reading, creative hobbies) rather than passive screen consumption.`,
    metadata: {
      category: 'stress',
      source: 'NIMH Stress Management Toolkit',
      lastUpdated: '2026-06-10'
    }
  },
  {
    content: `Guideline for Crisis Interventions and Self-Harm Detection:
- If a user mentions self-harm, suicidal ideation, or is in an active crisis, prioritize their physical safety immediately.
- Provide direct referral hotlines: Call/text 988 for the Suicide & Crisis Lifeline, or text HOME to 741741 for the Crisis Text Line.
- Use clear, non-judgmental, direct guidance; explicitly advise against substituting chat messages for professional medical or emergency response services.`,
    metadata: {
      category: 'crisis',
      source: 'WHO Crisis Response Protocols',
      lastUpdated: '2026-07-01'
    }
  }
];

async function main() {
  console.log("Seeding clinical guidelines...");

  // 1. Try to enable the pgvector extension in PostgreSQL
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("pgvector extension check/installation successful.");
  } catch (error) {
    console.warn(
      "Could not create vector extension (this is normal if using a database without pgvector installed, or non-Postgres). " +
      "Falling back to basic database table inserts without vector capabilities."
    );
  }

  // 2. Clear existing guidelines to prevent duplicates on repeated runs
  await prisma.guideline.deleteMany();
  console.log("Cleared existing guidelines.");

  // 3. Process and insert guidelines
  for (const item of guidelines) {
    console.log(`Processing embedding for guideline category: ${item.metadata.category}...`);
    let embedding: number[] | null = null;
    
    try {
      embedding = await getEmbedding(item.content);
    } catch (e) {
      console.error(`Failed to generate embedding for ${item.metadata.category}. Seeding without embedding.`, e);
    }

    try {
      if (embedding) {
        const id = crypto.randomUUID();
        // Since Prisma Unsupported("vector(768)") doesn't let us insert the vector directly via client,
        // we use a raw SQL query.
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Guideline" (id, content, metadata, embedding) 
           VALUES ($1, $2, $3::jsonb, $4::vector)`,
          id,
          item.content,
          JSON.stringify(item.metadata),
          `[${embedding.join(',')}]`
        );
        console.log(`Seeded guideline: ${item.metadata.category} with vector embedding.`);
      } else {
        // Fallback insertion without embedding
        await prisma.guideline.create({
          data: {
            content: item.content,
            metadata: item.metadata,
          }
        });
        console.log(`Seeded guideline: ${item.metadata.category} without vector embedding (fallback).`);
      }
    } catch (dbError) {
      console.error(`Database insertion failed for ${item.metadata.category}:`, dbError);
      
      // Secondary fallback: attempt standard create ignoring the embedding field
      try {
        await prisma.guideline.create({
          data: {
            content: item.content,
            metadata: item.metadata,
          }
        });
        console.log(`Seeded guideline (secondary fallback): ${item.metadata.category} without vector.`);
      } catch (secError) {
        console.error("Secondary fallback insert also failed:", secError);
      }
    }
  }

  console.log("Guidelines seeding process completed.");
}

main()
  .catch((e) => {
    console.error("Error running seed script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
