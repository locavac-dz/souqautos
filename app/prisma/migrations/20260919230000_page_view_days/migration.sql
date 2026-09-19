-- CreateTable
CREATE TABLE "PageViewDay" (
    "day" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "referrer" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageViewDay_pkey" PRIMARY KEY ("day","page","detail","locale","device","referrer")
);

