-- Lab reports and other documents attached to a date in the schedule.
-- The bytes live here rather than on disk: the container filesystem does not
-- survive a redeploy, so a file stored there would go missing on its own.
CREATE TABLE "milestone_attachments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "includeInExport" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "milestone_attachments_userId_idx" ON "milestone_attachments"("userId");

CREATE INDEX "milestone_attachments_milestoneId_idx" ON "milestone_attachments"("milestoneId");

ALTER TABLE "milestone_attachments" ADD CONSTRAINT "milestone_attachments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "milestone_attachments" ADD CONSTRAINT "milestone_attachments_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
