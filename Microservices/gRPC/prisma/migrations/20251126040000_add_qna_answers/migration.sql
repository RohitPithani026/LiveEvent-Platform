-- CreateTable
CREATE TABLE IF NOT EXISTS "qna_answers" (
    "id" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "qna_answers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qna_answers_userId_questionId_key" UNIQUE ("userId", "questionId")
);

-- AddForeignKey
ALTER TABLE "qna_answers" ADD CONSTRAINT "qna_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_answers" ADD CONSTRAINT "qna_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "qna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_answers" ADD CONSTRAINT "qna_answers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

