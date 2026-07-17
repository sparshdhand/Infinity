import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // Dynamically resolve connection string to support Vercel Supabase Integration variables out-of-the-box
  const connectionString = 
    process.env.POSTGRES_PRISMA_URL || 
    process.env.POSTGRES_URL || 
    process.env.DATABASE_URL;

  return new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
} & typeof global;

const getPrismaClient = () => {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = prismaClientSingleton();
  }
  return globalThis.prismaGlobal;
};

// Use a Proxy to lazy-load PrismaClient only when its properties are accessed
const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export default prisma;

