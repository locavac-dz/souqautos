-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "destinataireUtilisateurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "corps" TEXT,
    "lien" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "luLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_organisationId_destinataireUtilisateurId_lu_idx" ON "notification"("organisationId", "destinataireUtilisateurId", "lu");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
