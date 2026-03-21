-- CreateEnum
CREATE TYPE "DerbyType" AS ENUM ('DERBY');

-- CreateTable
CREATE TABLE "SeasonDerbyMatch" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "type" "DerbyType" NOT NULL,

    CONSTRAINT "SeasonDerbyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeasonDerbyMatch_seasonId_idx" ON "SeasonDerbyMatch"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonDerbyMatch_seasonId_homeTeamId_awayTeamId_type_key" ON "SeasonDerbyMatch"("seasonId", "homeTeamId", "awayTeamId", "type");

-- AddForeignKey
ALTER TABLE "SeasonDerbyMatch" ADD CONSTRAINT "SeasonDerbyMatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDerbyMatch" ADD CONSTRAINT "SeasonDerbyMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDerbyMatch" ADD CONSTRAINT "SeasonDerbyMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
