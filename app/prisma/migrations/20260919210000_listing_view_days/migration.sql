-- CreateTable
CREATE TABLE "ListingViewDay" (
    "listingId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ListingViewDay_pkey" PRIMARY KEY ("listingId","day")
);

-- AddForeignKey
ALTER TABLE "ListingViewDay" ADD CONSTRAINT "ListingViewDay_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

