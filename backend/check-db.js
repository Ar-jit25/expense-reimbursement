const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.user.findMany({ select: { id: true, email: true, name: true, role: true } })
  .then(users => {
    console.log("Current User table contents:");
    users.forEach(u => console.log(JSON.stringify(u)));
    console.log("Total:", users.length);
    return prisma.$disconnect();
  })
  .catch(e => { console.error(e.message); return prisma.$disconnect(); });
