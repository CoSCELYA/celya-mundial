-- Las eliminatorias son solo marcador: se eliminan sus preguntas de trivia
-- (y en cascada sus respuestas). Los puntos de trivia de la fase de grupos no
-- se ven afectados: PointsEntry referencia matchId, no la pregunta.
DELETE FROM "Question"
WHERE "matchId" IN (SELECT "id" FROM "Match" WHERE "phase" <> 'GROUP');
