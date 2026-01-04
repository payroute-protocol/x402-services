/*
  Warnings:

  - A unique constraint covering the columns `[gatewaySlug]` on the table `WrappedData` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WrappedData_gatewaySlug_key" ON "WrappedData"("gatewaySlug");
