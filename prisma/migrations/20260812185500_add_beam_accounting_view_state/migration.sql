CREATE TABLE "BeamAccountingViewState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hiddenBefore" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeamAccountingViewState_pkey" PRIMARY KEY ("id")
);
