-- Mini-tanda «Feedback RRHH»: fuente ampliada + detalle, descripción estructurada de la oferta y PDF adjunto.
-- 100 % aditiva: sin tablas nuevas (no requiere RLS), sin DROP, sin NOT NULL sin default.
-- ALTER TYPE ... ADD VALUE: en PostgreSQL >= 12 puede ir dentro de la transacción de la migración
-- siempre que los valores nuevos NO se usen en esa misma transacción (aquí no se usan). Producción y
-- dev/test corren PG 17. Prisma emite este mismo SQL.

-- AlterEnum
ALTER TYPE "CandidateSource" ADD VALUE 'STRATOS';
ALTER TYPE "CandidateSource" ADD VALUE 'IMPULSYN';
ALTER TYPE "CandidateSource" ADD VALUE 'UNIVERSIDAD';
ALTER TYPE "CandidateSource" ADD VALUE 'INFOJOBS';
ALTER TYPE "CandidateSource" ADD VALUE 'INDEED';
ALTER TYPE "CandidateSource" ADD VALUE 'WEB_EMPRESA';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "descripcionPdfNombre" TEXT,
ADD COLUMN     "descripcionPdfPath" TEXT,
ADD COLUMN     "funciones" TEXT,
ADD COLUMN     "objetivoPuesto" TEXT,
ADD COLUMN     "requisitosEducacion" TEXT,
ADD COLUMN     "requisitosExperiencia" TEXT,
ADD COLUMN     "seValorara" TEXT;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "fuenteDetalle" VARCHAR(200);
