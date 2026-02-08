/*
  Warnings:

  - You are about to drop the column `pAwayFair` on the `MatchComputed` table. All the data in the column will be lost.
  - You are about to drop the column `pDrawFair` on the `MatchComputed` table. All the data in the column will be lost.
  - You are about to drop the column `pHomeFair` on the `MatchComputed` table. All the data in the column will be lost.
  - Added the required column `pAwayImplied` to the `MatchComputed` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pDrawImplied` to the `MatchComputed` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pHomeImplied` to the `MatchComputed` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flipCoef` to the `Season` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: MatchComputed - migrate from pHomeFair/pDrawFair/pAwayFair to pHomeImplied/pDrawImplied/pAwayImplied
ALTER TABLE "MatchComputed" 
ADD COLUMN     "pAwayImplied" DOUBLE PRECISION,
ADD COLUMN     "pDrawImplied" DOUBLE PRECISION,
ADD COLUMN     "pHomeImplied" DOUBLE PRECISION;

-- Copy data from old columns to new columns (if old columns exist)
UPDATE "MatchComputed" 
SET "pHomeImplied" = COALESCE("pHomeFair", 0.333),
    "pDrawImplied" = COALESCE("pDrawFair", 0.333),
    "pAwayImplied" = COALESCE("pAwayFair", 0.333)
WHERE "pHomeImplied" IS NULL;

-- Make new columns NOT NULL and drop old columns
ALTER TABLE "MatchComputed" 
ALTER COLUMN "pAwayImplied" SET NOT NULL,
ALTER COLUMN "pDrawImplied" SET NOT NULL,
ALTER COLUMN "pHomeImplied" SET NOT NULL,
DROP COLUMN IF EXISTS "pAwayFair",
DROP COLUMN IF EXISTS "pDrawFair",
DROP COLUMN IF EXISTS "pHomeFair";

-- AlterTable: Season - add flipCoef with default value
ALTER TABLE "Season" ADD COLUMN     "flipCoef" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "Season" ALTER COLUMN "flipCoef" DROP DEFAULT;
