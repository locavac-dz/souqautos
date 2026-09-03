-- CreateTable
CREATE TABLE "ProfessionalAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nomCommercial" TEXT NOT NULL,
    "presentation" TEXT,
    "horaires" TEXT,
    "wilayaId" INTEGER,
    "badgeVerifie" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfessionalAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfessionalAccount_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProCollaborator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professionalAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LECTURE_SEULE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProCollaborator_professionalAccountId_fkey" FOREIGN KEY ("professionalAccountId") REFERENCES "ProfessionalAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalAccount_userId_key" ON "ProfessionalAccount"("userId");

-- CreateIndex
CREATE INDEX "ProfessionalAccount_wilayaId_idx" ON "ProfessionalAccount"("wilayaId");

-- CreateIndex
CREATE INDEX "ProCollaborator_userId_idx" ON "ProCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProCollaborator_professionalAccountId_userId_key" ON "ProCollaborator"("professionalAccountId", "userId");
