import { Trash2, UserCheck, UserX } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteUser, setUserStatus } from "@/app/admin/actions";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLE_LABEL } from "@/lib/constants";
import { NewUserButton, EditUserButton } from "./_components/user-actions";
import { ResetPasswordButton } from "./_components/password-dialog";

const TH =
  "px-4 py-3 text-left text-[11px] uppercase tracking-wide text-muted-foreground font-semibold";

export default async function UsuariosPage() {
  const session = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Gestión de usuarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Administra las cuentas, roles y estados de los participantes.
          </p>
        </div>
        <NewUserButton />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className={TH}>ID</th>
                <th className={TH}>Usuario</th>
                <th className={TH}>Nombre completo</th>
                <th className={TH}>Email / Documento</th>
                <th className={TH}>Rol</th>
                <th className={TH}>Estado</th>
                <th className={`${TH} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-border transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 tnum text-muted-foreground">
                    {user.id}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {user.email.split("@")[0]}
                  </td>
                  <td className="px-4 py-3 text-foreground">{user.fullName}</td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.documento || "Sin documento"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.role === "EMPLEADO" ? "neutral" : "yellow"}>
                      {ROLE_LABEL[user.role] ?? user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {user.id !== session.userId &&
                        (user.status === "ACTIVE" ? (
                          <form action={setUserStatus}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="status" value="INACTIVE" />
                            <SubmitButton
                              variant="ghost"
                              size="sm"
                              title="Inactivar usuario"
                              className="text-danger hover:bg-danger/10"
                            >
                              <UserX />
                              Inactivar
                            </SubmitButton>
                          </form>
                        ) : (
                          <form action={setUserStatus}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="status" value="ACTIVE" />
                            <SubmitButton variant="secondary" size="sm" title="Activar usuario">
                              <UserCheck />
                              Activar
                            </SubmitButton>
                          </form>
                        ))}
                      <ResetPasswordButton
                        user={{
                          id: user.id,
                          fullName: user.fullName,
                          email: user.email,
                        }}
                      />
                      <EditUserButton
                        user={{
                          id: user.id,
                          fullName: user.fullName,
                          email: user.email,
                          documento: user.documento,
                          role: user.role,
                          status: user.status,
                        }}
                      />
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={user.id} />
                        <SubmitButton
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar usuario"
                          title="Eliminar"
                          className="text-danger hover:bg-danger/10"
                        >
                          <Trash2 />
                        </SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
