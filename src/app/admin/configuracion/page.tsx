import { requireSuperAdmin } from "@/lib/auth";
import { getScoringConfig } from "@/lib/scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigForm } from "./_components/config-form";

export default async function ConfiguracionPage() {
  await requireSuperAdmin();
  const config = await getScoringConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configuración de puntaje</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define cuántos puntos otorga cada acierto y los plazos de bloqueo. Solo el Super Admin
          puede modificar estos valores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parámetros del concurso</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigForm config={config} />
        </CardContent>
      </Card>
    </div>
  );
}
