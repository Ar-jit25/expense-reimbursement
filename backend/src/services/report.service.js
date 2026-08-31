const prisma = require('../config/prisma');

class ReportService {
  async createReport(ownerId, { title, dateFrom, dateTo }) {
    return prisma.expenseReport.create({
      data: {
        title,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        ownerId,
        status: 'DRAFT',
      }
    });
  }

  async getMyReports(ownerId, includeArchived = false) {
    const where = { ownerId };
    if (!includeArchived) {
      where.isArchived = false;
    }
    
    // Fetch reports with their lines to calculate totals
    const reports = await prisma.expenseReport.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total on the fly
    return reports.map(report => ({
      ...report,
      total: report.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    }));
  }

  async getReportById(id, ownerId) {
    const report = await prisma.expenseReport.findUnique({
      where: { id: parseInt(id) },
      include: { lines: true, history: true, comments: true }
    });

    if (!report) return null;
    
    return {
      ...report,
      total: report.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    };
  }

  async updateReport(id, { title, dateFrom, dateTo }) {
    return prisma.expenseReport.update({
      where: { id: parseInt(id) },
      data: {
        title,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined
      }
    });
  }

  async setArchiveStatus(id, isArchived) {
    return prisma.expenseReport.update({
      where: { id: parseInt(id) },
      data: { isArchived }
    });
  }
}

module.exports = new ReportService();
