const prisma = require("./backend/src/config/prisma.js");
console.log(Object.keys(prisma).filter(k => !k.startsWith('_')));
