-- CreateTable
CREATE TABLE "SellerGroupMapping" (
    "id" TEXT NOT NULL,
    "sellerPhone" TEXT NOT NULL,
    "sellerName" TEXT,
    "groupJid" TEXT NOT NULL,
    "groupName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerGroupMapping_sellerPhone_key" ON "SellerGroupMapping"("sellerPhone");
