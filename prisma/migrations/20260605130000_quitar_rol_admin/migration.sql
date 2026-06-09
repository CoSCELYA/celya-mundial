-- Solo existe un administrador (SUPER_ADMIN). Cualquier ADMIN residual pasa a EMPLEADO.
UPDATE "User" SET "role" = 'EMPLEADO' WHERE "role" = 'ADMIN';

-- Recrea el enum Role sin el valor ADMIN.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'EMPLEADO');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EMPLEADO';
DROP TYPE "Role_old";
