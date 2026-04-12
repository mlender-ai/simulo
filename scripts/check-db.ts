// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    const count = await prisma.analysis.count();
    console.log("✓ DB 연결 성공. 분석 기록 수:", count);
  } catch (error) {
    console.error("✗ DB 연결 실패:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
