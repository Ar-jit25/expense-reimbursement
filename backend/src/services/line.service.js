const prisma = require('../config/prisma');

class LineService {
  async addLine(reportId, { date, amount, category, description }) {
    return prisma.expenseLine.create({
      data: {
        reportId: parseInt(reportId),
        date: new Date(date),
        amount,
        category,
        description
      }
    });
  }

  async updateLine(lineId, { date, amount, category, description }) {
    return prisma.expenseLine.update({
      where: { id: parseInt(lineId) },
      data: {
        date: date ? new Date(date) : undefined,
        amount,
        category,
        description
      }
    });
  }

  async removeLine(lineId) {
    return prisma.expenseLine.delete({
      where: { id: parseInt(lineId) }
    });
  }
}

module.exports = new LineService();
