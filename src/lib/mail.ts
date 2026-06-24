import nodemailer from 'nodemailer';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const res = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (res.length > 0) {
      return res[0].value;
    }
  } catch (e) {
    // Tabela może jeszcze nie istnieć podczas pierwszego uruchomienia lub seedowania
  }
  return defaultValue;
}

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  // Pobieranie konfiguracji z bazy danych lub zmiennych środowiskowych
  const host = await getSetting('smtp_host', process.env.SMTP_HOST || '');
  const portStr = await getSetting('smtp_port', process.env.SMTP_PORT || '587');
  const secureStr = await getSetting('smtp_secure', process.env.SMTP_SECURE || 'false');
  const user = await getSetting('smtp_user', process.env.SMTP_USER || '');
  const pass = await getSetting('smtp_password', process.env.SMTP_PASSWORD || '');
  const from = await getSetting('smtp_from', process.env.SMTP_FROM || 'Drift Park Extreme <no-reply@driftparkextreme.pl>');

  const port = Number(portStr);
  const secure = secureStr === 'true';

  const emailLogContent = `
========================================================================
DATA: ${new Date().toLocaleString('pl-PL')}
DO: ${to}
TEMAT: ${subject}
TREŚĆ:
${html}
========================================================================
\n`;

  // Zawsze logujemy wysłany e-mail do pliku lokalnego w celach deweloperskich/rezerwowych
  try {
    const logDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, 'sent_emails.log'), emailLogContent);
    console.log(`[Email Log] Zapisano e-mail do scratch/sent_emails.log`);
  } catch (err) {
    console.error('Błąd zapisu logu e-mail:', err);
  }

  // Jeśli brak skonfigurowanego serwera SMTP, kończymy na logowaniu lokalnym (przydatne w środowisku deweloperskim)
  if (!host || !user || !pass) {
    console.log(`[SMTP] Brak pełnej konfiguracji SMTP w bazie. E-mail został zapisany lokalnie w scratch/sent_emails.log.`);
    return { success: true, loggedLocally: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log(`[SMTP] Pomyślnie wysłano e-mail do ${to}`);
    return { success: true, loggedLocally: false };
  } catch (error: any) {
    console.error(`[SMTP Error] Błąd podczas wysyłania e-maila do ${to}:`, error);
    return { success: false, error: error.message || 'Błąd serwera SMTP' };
  }
}
