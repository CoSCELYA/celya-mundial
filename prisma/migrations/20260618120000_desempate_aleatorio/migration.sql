-- Desempate aleatorio en la tabla de posiciones.
-- Cada usuario recibe un valor aleatorio; los empates se rebarajan cada vez
-- que se recalculan puntos (reshuffleTiebreakers en lib/scoring).
ALTER TABLE "User" ADD COLUMN "tiebreaker" DOUBLE PRECISION NOT NULL DEFAULT random();
