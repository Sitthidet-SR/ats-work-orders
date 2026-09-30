-- Preserve existing material rows and their legacy fields while adding a grade for new entries.
ALTER TABLE "work_order_materials" ADD COLUMN "materialGrade" TEXT NOT NULL DEFAULT '';
