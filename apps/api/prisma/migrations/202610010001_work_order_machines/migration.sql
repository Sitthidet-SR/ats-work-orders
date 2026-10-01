-- Add a separate machine list while retaining the legacy machineId on every
-- existing work order. No work order rows or historical machine values are deleted.
CREATE TABLE IF NOT EXISTS "work_order_machines" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "machineId" UUID NOT NULL,
    "quantity" DECIMAL(16,4),
    "remark" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "work_order_machines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "work_order_machines_workOrderId_sortOrder_idx"
    ON "work_order_machines"("workOrderId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_order_machines_workOrderId_fkey'
  ) THEN
    ALTER TABLE "work_order_machines"
      ADD CONSTRAINT "work_order_machines_workOrderId_fkey"
      FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_order_machines_machineId_fkey'
  ) THEN
    ALTER TABLE "work_order_machines"
      ADD CONSTRAINT "work_order_machines_machineId_fkey"
      FOREIGN KEY ("machineId") REFERENCES "machines"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Copy each legacy machine selection to the first position of the new list.
INSERT INTO "work_order_machines" ("id", "workOrderId", "machineId", "quantity", "remark", "sortOrder")
SELECT md5("id"::text || ':legacy-machine')::uuid, "id", "machineId", NULL, '', 0
FROM "work_orders"
WHERE "machineId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "work_order_machines" AS "machine"
    WHERE "machine"."workOrderId" = "work_orders"."id"
  );

-- New orders use the list above. The legacy column is retained for history.
ALTER TABLE "work_orders" ALTER COLUMN "machineId" DROP NOT NULL;
