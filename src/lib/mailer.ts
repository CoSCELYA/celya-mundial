import "server-only";

type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Sends an email via Resend if RESEND_API_KEY is set; otherwise logs to the
 * console (development fallback). Returns true if "delivered".
 */
export async function sendMail({ to, subject, html, text }: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Polla Mundialista <no-reply@celya.co>";

  if (!key) {
    console.log("\n=== [DEV] Correo no enviado (sin RESEND_API_KEY) ===");
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(text);
    console.log("===================================================\n");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error("Resend error:", await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Error enviando correo:", e);
    return false;
  }
}

export function resetEmail(name: string, url: string): { subject: string; html: string; text: string } {
  const subject = "Recupera tu contraseña · Polla Mundialista";
  const text = `Hola ${name},\n\nRecibimos una solicitud para restablecer tu contraseña.\nAbre este enlace para crear una nueva (válido por 1 hora):\n\n${url}\n\nSi no fuiste tú, ignora este correo.`;
  const html = `
    <div style="font-family:Poppins,Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#000213">Recupera tu contraseña</h2>
      <p>Hola ${name}, recibimos una solicitud para restablecer tu contraseña.</p>
      <p>
        <a href="${url}" style="display:inline-block;background:#FFCD00;color:#000213;
           padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">
          Crear nueva contraseña
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">El enlace es válido por 1 hora. Si no fuiste tú, ignora este correo.</p>
    </div>`;
  return { subject, html, text };
}
