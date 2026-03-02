-- CreateTable
CREATE TABLE "wishes" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "flower" TEXT NOT NULL DEFAULT '🌸',
    "message" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wishes_toId_createdAt_idx" ON "wishes"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "wishes_fromId_idx" ON "wishes"("fromId");

-- CreateIndex
CREATE INDEX "card_likes_targetUserId_idx" ON "card_likes"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "card_likes_userId_targetUserId_key" ON "card_likes"("userId", "targetUserId");

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_toId_fkey" FOREIGN KEY ("toId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_likes" ADD CONSTRAINT "card_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_likes" ADD CONSTRAINT "card_likes_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
