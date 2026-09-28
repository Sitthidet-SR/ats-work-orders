ALTER TABLE "work_orders" ADD COLUMN "issuerDisplayName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "quantityText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "work_orders" ALTER COLUMN "quantity" DROP NOT NULL;
ALTER TABLE "work_order_materials" ALTER COLUMN "quantity" DROP NOT NULL;
ALTER TABLE "work_orders" ADD CONSTRAINT "quantity_or_text_required"
  CHECK ("quantity" IS NOT NULL OR length(trim("quantityText")) > 0);

CREATE TABLE "work_order_pdfs" (
  "id" UUID NOT NULL,
  "workOrderId" UUID NOT NULL,
  "orderVersion" INTEGER NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "documentNo" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_order_pdfs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_order_pdfs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_order_pdfs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_order_pdfs_size_check" CHECK ("size" = octet_length("content") AND "size" > 0)
);
CREATE UNIQUE INDEX "work_order_pdfs_workOrderId_orderVersion_templateVersion_key" ON "work_order_pdfs"("workOrderId", "orderVersion", "templateVersion");
CREATE INDEX "work_order_pdfs_workOrderId_createdAt_idx" ON "work_order_pdfs"("workOrderId", "createdAt");
CREATE FUNCTION prevent_pdf_archive_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Archived PDFs are immutable';
END;
$$;
CREATE TRIGGER immutable_pdf_archive BEFORE UPDATE OR DELETE ON "work_order_pdfs"
FOR EACH ROW EXECUTE FUNCTION prevent_pdf_archive_changes();
