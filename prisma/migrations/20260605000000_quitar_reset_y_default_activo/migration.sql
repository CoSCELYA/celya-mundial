-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "PasswordResetToken";

