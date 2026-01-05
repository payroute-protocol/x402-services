/*
  Warnings:

  - Added the required column `gatewaySlug` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "gatewaySlug" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL;
