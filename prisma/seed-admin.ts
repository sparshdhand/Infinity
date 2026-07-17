import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@infinity.com';
  const rawPassword = 'InfinityAdmin123!';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log(`Admin user ${email} already exists.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name: 'Infinity Admin',
      password: hashedPassword,
      role: 'admin'
    }
  });

  console.log('----------------------------------------');
  console.log('Default Admin User Created Successfully:');
  console.log(`Email:    ${email}`);
  console.log(`Password: ${rawPassword}`);
  console.log('----------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
