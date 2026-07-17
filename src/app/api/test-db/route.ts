import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rawUrl = process.env.DATABASE_URL || '';
    
    // Redact password in the URL for security
    let redactedUrl = 'NOT_SET';
    if (rawUrl) {
      redactedUrl = rawUrl.replace(/:([^:@]+)@/, ':****@');
    }

    // Attempt to query the database
    const users = await prisma.user.findMany({
      select: {
        email: true,
        role: true,
      }
    });

    const adminExists = users.some(u => u.email === 'admin@infinity.com');

    return NextResponse.json({
      status: 'success',
      databaseUrlConfigured: !!rawUrl,
      databaseHost: redactedUrl,
      totalUsersFound: users.length,
      usersList: users.map(u => ({ email: u.email, role: u.role })),
      adminUserExistsInThisDatabase: adminExists,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
