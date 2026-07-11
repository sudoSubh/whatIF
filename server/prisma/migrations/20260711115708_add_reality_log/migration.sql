-- CreateTable
CREATE TABLE "RealityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "actualOutcome" TEXT NOT NULL,
    "predictionMatched" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealityLog_userId_idx" ON "RealityLog"("userId");

-- CreateIndex
CREATE INDEX "RealityLog_timelineId_idx" ON "RealityLog"("timelineId");

-- CreateIndex
CREATE INDEX "RealityLog_eventId_idx" ON "RealityLog"("eventId");

-- AddForeignKey
ALTER TABLE "RealityLog" ADD CONSTRAINT "RealityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealityLog" ADD CONSTRAINT "RealityLog_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealityLog" ADD CONSTRAINT "RealityLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
