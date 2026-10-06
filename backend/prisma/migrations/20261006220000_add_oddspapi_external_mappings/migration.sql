-- CreateEnum
CREATE TYPE "ExternalDataProvider" AS ENUM ('ODDSPAPI');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "source" "ExternalDataProvider",
ADD COLUMN     "externalFixtureId" TEXT;

-- CreateTable
CREATE TABLE "ExternalLeagueMapping" (
    "id" TEXT NOT NULL,
    "provider" "ExternalDataProvider" NOT NULL,
    "externalTournamentId" TEXT NOT NULL,
    "externalName" TEXT,
    "leagueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalLeagueMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalTeamMapping" (
    "id" TEXT NOT NULL,
    "provider" "ExternalDataProvider" NOT NULL,
    "externalParticipantId" TEXT NOT NULL,
    "externalName" TEXT,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTeamMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Match_source_externalFixtureId_key" ON "Match"("source", "externalFixtureId");

-- CreateIndex
CREATE INDEX "Match_externalFixtureId_idx" ON "Match"("externalFixtureId");

-- CreateIndex
CREATE INDEX "ExternalLeagueMapping_leagueId_idx" ON "ExternalLeagueMapping"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLeagueMapping_provider_externalTournamentId_key" ON "ExternalLeagueMapping"("provider", "externalTournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLeagueMapping_provider_leagueId_key" ON "ExternalLeagueMapping"("provider", "leagueId");

-- CreateIndex
CREATE INDEX "ExternalTeamMapping_seasonId_idx" ON "ExternalTeamMapping"("seasonId");

-- CreateIndex
CREATE INDEX "ExternalTeamMapping_teamId_idx" ON "ExternalTeamMapping"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTeamMapping_provider_externalParticipantId_seasonId_key" ON "ExternalTeamMapping"("provider", "externalParticipantId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTeamMapping_provider_teamId_key" ON "ExternalTeamMapping"("provider", "teamId");

-- AddForeignKey
ALTER TABLE "ExternalLeagueMapping" ADD CONSTRAINT "ExternalLeagueMapping_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeamMapping" ADD CONSTRAINT "ExternalTeamMapping_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeamMapping" ADD CONSTRAINT "ExternalTeamMapping_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
