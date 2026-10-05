-- Lot 252 — messagerie de groupe

CREATE TABLE "GroupConversation" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupMember" (
    "groupId"    TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "isAdmin"    BOOLEAN NOT NULL DEFAULT false,
    "joinedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId", "userId")
);

CREATE TABLE "GroupMessage" (
    "id"            TEXT NOT NULL,
    "groupId"       TEXT NOT NULL,
    "senderId"      TEXT NOT NULL,
    "content"       TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "audioUrl"      TEXT,
    "deletedAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroupConversation_createdById_idx" ON "GroupConversation"("createdById");
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE INDEX "GroupMessage_groupId_idx" ON "GroupMessage"("groupId");
CREATE INDEX "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");

ALTER TABLE "GroupConversation"
    ADD CONSTRAINT "GroupConversation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GroupMember"
    ADD CONSTRAINT "GroupMember_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "GroupConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMember"
    ADD CONSTRAINT "GroupMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GroupMessage"
    ADD CONSTRAINT "GroupMessage_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "GroupConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMessage"
    ADD CONSTRAINT "GroupMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
