-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'APPROVER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TRAVEL', 'MEALS', 'ACCOMMODATION', 'SUPPLIES', 'SOFTWARE', 'EQUIPMENT', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_reports" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "expense_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_lines" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_approvers" (
    "reportId" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_approvers_pkey" PRIMARY KEY ("reportId","approverId")
);

-- CreateTable
CREATE TABLE "report_history" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "ReportStatus",
    "toStatus" "ReportStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stale_alerts" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stale_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "expense_reports_ownerId_idx" ON "expense_reports"("ownerId");

-- CreateIndex
CREATE INDEX "expense_reports_status_idx" ON "expense_reports"("status");

-- CreateIndex
CREATE INDEX "expense_reports_submittedAt_idx" ON "expense_reports"("submittedAt");

-- CreateIndex
CREATE INDEX "expense_reports_status_submittedAt_idx" ON "expense_reports"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "expense_lines_reportId_idx" ON "expense_lines"("reportId");

-- CreateIndex
CREATE INDEX "report_approvers_approverId_idx" ON "report_approvers"("approverId");

-- CreateIndex
CREATE INDEX "report_history_reportId_idx" ON "report_history"("reportId");

-- CreateIndex
CREATE INDEX "comments_reportId_idx" ON "comments"("reportId");

-- CreateIndex
CREATE INDEX "stale_alerts_approverId_idx" ON "stale_alerts"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "stale_alerts_reportId_approverId_key" ON "stale_alerts"("reportId", "approverId");

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "expense_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_approvers" ADD CONSTRAINT "report_approvers_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "expense_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_approvers" ADD CONSTRAINT "report_approvers_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "expense_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "expense_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stale_alerts" ADD CONSTRAINT "stale_alerts_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "expense_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stale_alerts" ADD CONSTRAINT "stale_alerts_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
