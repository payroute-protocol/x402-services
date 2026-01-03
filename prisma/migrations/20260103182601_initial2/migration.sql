/*
  Warnings:

  - Added the required column `urlWrapped` to the `WrappedData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WrappedData" ADD COLUMN     "urlWrapped" TEXT NOT NULL;
