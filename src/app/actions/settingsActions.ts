'use server';

import { db } from "@/db";
import { users, settings } from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { sendMail, getSetting } from "@/lib/mail";

/**
 * Zabezpiecza akcje ustawień - pozwala na dostęp tylko dla ról 'owner' oraz 'technik'
 */
async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Brak autoryzacji.");
  }
  const role = (session.user as any).role;
  if (role !== "owner" && role !== "technik") {
    throw new Error("Brak uprawnień do tej operacji.");
  }
  return session;
}

/**
 * Pobiera wszystkie ustawienia systemowe z bazy danych
 */
export async function getSettingsAction() {
  await checkAuth();

  try {
    const results = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    results.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    return { success: true, settings: settingsMap };
  } catch (e: any) {
    console.error("Błąd podczas pobierania ustawień:", e);
    return { success: false, error: "Błąd bazy danych przy pobieraniu ustawień." };
  }
}

/**
 * Zapisuje konfigurację SMTP oraz szablony e-mail w bazie danych
 */
export async function saveSettingsAction(settingsData: Record<string, string>) {
  await checkAuth();

  try {
    for (const [key, value] of Object.entries(settingsData)) {
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(settings)
          .set({ value: value.trim() })
          .where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({
          key,
          value: value.trim()
        });
      }
    }

    console.log("[Settings] Pomyślnie zaktualizowano ustawienia systemowe.");
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas zapisywania ustawień:", e);
    return { success: false, error: "Błąd bazy danych podczas zapisu ustawień." };
  }
}

/**
 * Pobiera listę wszystkich użytkowników w systemie (do wyświetlenia w panelu ustawień)
 */
export async function getUsersAction() {
  await checkAuth();

  try {
    const allUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        position: users.position,
        birthDate: users.birthDate,
        mustChangePassword: users.mustChangePassword,
        hourlyRate: users.hourlyRate,
        createdAt: users.createdAt
      })
      .from(users);

    return { success: true, users: allUsers };
  } catch (e: any) {
    console.error("Błąd podczas pobierania użytkowników:", e);
    return { success: false, users: [], error: "Błąd bazy danych przy pobieraniu użytkowników." };
  }
}

/**
 * Tworzy nowego użytkownika w systemie, generuje hasło tymczasowe, wysyła je e-mailem
 * i ustawia wymóg zmiany hasła przy pierwszym logowaniu.
 */
export async function createUserAction(userData: {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  role: 'owner' | 'manager' | 'employee' | 'technik';
  position: string;
  birthDate: string;
  hourlyRate: number;
}) {
  const session = await checkAuth();

  const { firstName, lastName, displayName, email, role, position, birthDate, hourlyRate } = userData;

  if (!firstName || !lastName || !displayName || !email || !role || !position || !birthDate) {
    return { success: false, error: "Wszystkie pola są wymagane." };
  }

  try {
    // Sprawdzenie unikalności e-maila
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim()))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Użytkownik o podanym adresie e-mail już istnieje." };
    }

    // Generowanie losowego, bezpiecznego hasła tymczasowego
    const tempPassword = Math.random().toString(36).substring(2, 12);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Wstawianie użytkownika
    await db.insert(users).values({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role,
      position: position.trim(),
      birthDate: birthDate.trim(),
      mustChangePassword: true, // Wymuszamy zmianę przy pierwszym logowaniu
      hourlyRate: hourlyRate || 0,
      isDemo: false
    });

    console.log(`[Settings] Utworzono konto dla ${email} z hasłem tymczasowym: ${tempPassword}`);

    // Pobieranie adresu URL strony do linku w e-mailu
    const baseUrl = await getSetting('site_url', process.env.NEXTAUTH_URL || "http://localhost:3000");

    // Budowanie wiadomości e-mail z danymi logowania
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f0f0f; color: #e0e0e0; border-radius: 10px; border: 1px solid #ffaa00;">
        <h2 style="color: #ffd700; border-bottom: 1px solid #333; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Drift Park Extreme</h2>
        <p style="font-size: 16px;">Witaj, <strong>${displayName}</strong>!</p>
        <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0;">
          Twoje konto pracownicze w systemie ewidencji czasu pracy zostało utworzone przez administratora (${session.user?.name}).
        </p>
        <div style="background-color: #161616; padding: 15px; border-radius: 8px; border-left: 4px solid #ffaa00; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #888;">Dane do pierwszego logowania:</p>
          <p style="margin: 0 0 6px 0; font-size: 14px; color: #fff;"><strong>Login (E-mail):</strong> ${email.trim().toLowerCase()}</p>
          <p style="margin: 0; font-size: 14px; color: #fff;"><strong>Hasło tymczasowe:</strong> <span style="font-family: monospace; font-size: 15px; color: #ffd700; background: #000; padding: 2px 6px; border-radius: 4px;">${tempPassword}</span></p>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0;">
          <strong>Uwaga:</strong> Przy pierwszym logowaniu system ze względów bezpieczeństwa będzie wymagał od Ciebie natychmiastowej zmiany hasła tymczasowego na własne.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/login" style="background-color: #ffaa00; color: #0f0f0f; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 12px rgba(255, 170, 0, 0.2);">Zaloguj się do panelu</a>
        </div>
        <p style="font-size: 11px; color: #555; border-top: 1px solid #222; padding-top: 15px;">
          Ta wiadomość została wygenerowana automatycznie. Prosimy na nią nie odpowiadać.<br/>
          Panel: <a href="${baseUrl}/login" style="color: #ffaa00; text-decoration: underline;">${baseUrl}/login</a>
        </p>
      </div>
    `;

    // Wysyłamy e-mail
    await sendMail({
      to: email.trim(),
      subject: "Drift Park Extreme - Dane do logowania",
      html: emailHtml
    });

    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas tworzenia użytkownika:", e);
    return { success: false, error: "Błąd bazy danych przy tworzeniu użytkownika." };
  }
}

/**
 * Usuwa użytkownika z systemu.
 * Uniemożliwia usunięcie samego siebie.
 */
export async function deleteUserAction(userId: number) {
  const session = await checkAuth();
  const currentUserId = Number((session.user as any).id);

  if (userId === currentUserId) {
    return { success: false, error: "Nie możesz usunąć własnego konta." };
  }

  try {
    await db.delete(users).where(eq(users.id, userId));
    console.log(`[Settings] Użytkownik o ID ${userId} został usunięty przez ID ${currentUserId}`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas usuwania użytkownika:", e);
    return { success: false, error: "Błąd bazy danych przy usuwaniu użytkownika." };
  }
}

/**
 * Testuje połączenie SMTP na podstawie przesłanej konfiguracji (przed zapisaniem)
 */
export async function testSmtpConnectionAction(config: {
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}) {
  await checkAuth();

  const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password } = config;

  if (!smtp_host || !smtp_user || !smtp_password) {
    return { success: false, error: "Host, użytkownik oraz hasło są wymagane do przeprowadzenia testu." };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: Number(smtp_port),
      secure: smtp_secure === 'true',
      auth: {
        user: smtp_user,
        pass: smtp_password,
      },
      family: 4, // Wymuszenie IPv4 z powodu braku routingu IPv6 na serwerze (ENETUNREACH)
      connectTimeout: 8000, // 8 sekund timeoutu
    } as any);

    // Weryfikacja połączenia
    await transporter.verify();
    return { success: true };
  } catch (e: any) {
    console.error("[SMTP Test Error]:", e);
    return { success: false, error: e.message || "Nieznany błąd podczas weryfikacji połączenia." };
  }
}

export async function updateUserRateAction(userId: number, rate: number) {
  await checkAuth();
  if (rate < 0) return { success: false, error: "Stawka nie może być ujemna." };

  try {
    await db
      .update(users)
      .set({ hourlyRate: rate })
      .where(eq(users.id, userId));
    
    console.log(`[Settings] Zaktualizowano stawkę użytkownika ID: ${userId} na: ${rate} PLN/h`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas aktualizacji stawki:", e);
    return { success: false, error: "Błąd bazy danych przy aktualizacji stawki." };
  }
}
