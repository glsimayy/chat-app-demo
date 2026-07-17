import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@example.com';
  
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: 'admin',
      passwordHash: 'gecici_sifre_123',
      // HATA 1 DÜZELTMESİ: 'ADMIN' yerine 'admin' yazdık
      role: 'admin', 
    },
  });
  console.log('Admin oluşturuldu:', admin);
}

main()
  .catch((e) => {
    console.error(e);
    // HATA 2 DÜZELTMESİ: Global değişken sorununu aşmak için process'i doğrudan kullanacağız
    // Eğer hala hata verirse, aşağıda verdiğim tsconfig çözümüne bak
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });