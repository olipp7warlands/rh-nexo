-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "sociedadId" TEXT;

-- CreateIndex
CREATE INDEX "Job_sociedadId_idx" ON "Job"("sociedadId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "Sociedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
