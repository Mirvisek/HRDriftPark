'use server';

import { db } from "@/db";
import { users, settings, salaryHistory, venues, workSchedule, timesheets, warehouseProducts } from "@/db/schema";
import { eq, ne, and, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { sendMail, getSetting } from "@/lib/mail";
import { hasPermission, PermissionKey } from "@/lib/permissions";

/**
 * Zabezpiecza akcje ustawień - weryfikuje posiadanie danego uprawnienia przez zalogowanego użytkownika
 */
async function checkAuth(permission?: PermissionKey) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Brak autoryzacji.");
  }
  if (permission && !hasPermission(session.user, permission)) {
    throw new Error("Brak uprawnień do tej operacji.");
  }
  return session;
}

/**
 * Pobiera wszystkie ustawienia systemowe z bazy danych
 */
export async function getSettingsAction() {
  await checkAuth('settings:edit');

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
  await checkAuth('settings:edit');

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
  const session = await checkAuth('users:manage');
  const userIsDemo = (session?.user as any)?.isDemo === true;

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
        createdAt: users.createdAt,
        permissions: users.permissions,
        venueId: users.venueId
      })
      .from(users)
      .where(eq(users.isDemo, userIsDemo));

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
  permissions?: string;
  venueId?: number;
}) {
  const session = await checkAuth('users:manage');

  const { firstName, lastName, displayName, email, role, position, birthDate, hourlyRate, permissions } = userData;

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

    // Wyliczenie domyślnych uprawnień w przypadku braku przesłanych
    let userPermissions = permissions;
    if (userPermissions === undefined) {
      if (role === 'owner') {
        userPermissions = "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,settings:edit,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage";
      } else if (role === 'manager') {
        userPermissions = "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory";
      } else if (role === 'technik') {
        userPermissions = "schedule:view,timesheet:view_own,tasks:view,tasks:edit,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage";
      } else {
        userPermissions = "schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory";
      }
    }

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
      mustChangePassword: true,
      hourlyRate: hourlyRate || 0,
      permissions: userPermissions,
      venueId: userData.venueId || null,
      isDemo: (session?.user as any)?.isDemo === true
    });

    // Pobierz utworzonego użytkownika, by uzyskać jego ID i zapisać stawkę początkową
    const dbUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    if (dbUsers.length > 0) {
      const createdUserId = dbUsers[0].id;
      const todayStr = new Date().toISOString().split('T')[0];
      await db.insert(salaryHistory).values({
        userId: createdUserId,
        hourlyRate: hourlyRate || 0,
        validFrom: todayStr,
        validTo: null
      });
    }

    console.log(`[Settings] Utworzono konto dla ${email} z hasłem tymczasowym: ${tempPassword} oraz dodano stawkę początkową do historii.`);

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
  const session = await checkAuth('users:manage');
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
  await checkAuth('settings:edit');

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
  await checkAuth('users:manage');
  if (rate < 0) return { success: false, error: "Stawka nie może być ujemna." };

  try {
    // 1. Zaktualizuj stawkę w tabeli users (fallback)
    await db
      .update(users)
      .set({ hourlyRate: rate })
      .where(eq(users.id, userId));
    
    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Zamknij obecnie aktywną stawkę w salary_history (validTo = wczoraj)
    const activeRate = await db
      .select()
      .from(salaryHistory)
      .where(and(eq(salaryHistory.userId, userId), isNull(salaryHistory.validTo)))
      .limit(1);

    if (activeRate.length > 0) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      await db
        .update(salaryHistory)
        .set({ validTo: yesterdayStr })
        .where(eq(salaryHistory.id, activeRate[0].id));
    }

    // 3. Wstaw nową stawkę w salary_history zaczynającą się od dzisiaj
    await db.insert(salaryHistory).values({
      userId,
      hourlyRate: rate,
      validFrom: todayStr,
      validTo: null
    });
    
    console.log(`[Settings] Zaktualizowano stawkę użytkownika ID: ${userId} na: ${rate} PLN/h oraz zaktualizowano historię.`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas aktualizacji stawki:", e);
    return { success: false, error: "Błąd bazy danych przy aktualizacji stawki." };
  }
}

export async function updateUserAction(
  userId: number,
  userData: {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    role: 'owner' | 'manager' | 'employee' | 'technik';
    position: string;
    birthDate: string;
    permissions?: string;
    venueId?: number;
  }
) {
  const session = await checkAuth('users:manage');
  const { firstName, lastName, displayName, email, role, position, birthDate, permissions } = userData;

  if (!firstName || !lastName || !displayName || !email || !role || !position || !birthDate) {
    return { success: false, error: "Wszystkie pola są wymagane." };
  }

  try {
    // Sprawdzenie unikalności e-maila (z wyłączeniem obecnego użytkownika)
    const existing = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email.trim()), ne(users.id, userId)))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Inny użytkownik o podanym adresie e-mail już istnieje." };
    }

    await db
      .update(users)
      .set({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        role,
        position: position.trim(),
        birthDate: birthDate.trim(),
        permissions: permissions || '',
        venueId: userData.venueId || null
      })
      .where(eq(users.id, userId));

    console.log(`[Settings] Zaktualizowano konto ID: ${userId} (${email}) przez ${session.user?.name}`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas aktualizacji użytkownika:", e);
    return { success: false, error: "Błąd bazy danych przy aktualizacji użytkownika." };
  }
}

export async function resetUserPasswordAction(userId: number) {
  const session = await checkAuth('users:manage');

  try {
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return { success: false, error: "Nie znaleziono użytkownika." };
    }

    const targetUser = userResult[0];

    // Generowanie nowego hasła tymczasowego
    const tempPassword = Math.random().toString(36).substring(2, 12);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Zapis w bazie
    await db
      .update(users)
      .set({
        password: hashedPassword,
        mustChangePassword: true
      })
      .where(eq(users.id, userId));

    console.log(`[Settings] Zresetowano hasło dla ${targetUser.email} przez ${session.user?.name}`);

    // Próba wysłania e-maila informacyjnego (jeśli konfiguracja SMTP jest poprawna)
    try {
      const baseUrl = await getSetting('site_url', process.env.NEXTAUTH_URL || "http://localhost:3000");
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f0f0f; color: #e0e0e0; border-radius: 10px; border: 1px solid #ffaa00;">
          <h2 style="color: #ffd700; border-bottom: 1px solid #333; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Drift Park Extreme</h2>
          <p style="font-size: 16px;">Witaj, <strong>${targetUser.displayName}</strong>!</p>
          <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0;">
            Twoje hasło do konta zostało zresetowane przez administratora (${session.user?.name}).
          </p>
          <div style="background-color: #161616; padding: 15px; border-radius: 8px; border-left: 4px solid #ffaa00; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #888;">Nowe dane do logowania:</p>
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #fff;"><strong>Login (E-mail):</strong> ${targetUser.email}</p>
            <p style="margin: 0; font-size: 14px; color: #fff;"><strong>Hasło tymczasowe:</strong> <span style="font-family: monospace; font-size: 15px; color: #ffd700; background: #000; padding: 2px 6px; border-radius: 4px;">${tempPassword}</span></p>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0;">
            <strong>Uwaga:</strong> Przy kolejnym logowaniu system będzie wymagał od Ciebie natychmiastowej zmiany tego hasła tymczasowego na własne.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/login" style="background-color: #ffaa00; color: #0f0f0f; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 12px rgba(255, 170, 0, 0.2);">Przejdź do logowania</a>
          </div>
          <p style="font-size: 11px; color: #555; border-top: 1px solid #222; padding-top: 15px;">
            Ta wiadomość została wygenerowana automatycznie.<br/>
            Panel: <a href="${baseUrl}/login" style="color: #ffaa00; text-decoration: underline;">${baseUrl}/login</a>
          </p>
        </div>
      `;

      await sendMail({
        to: targetUser.email,
        subject: "Drift Park Extreme - Reset hasła",
        html: emailHtml
      });
    } catch (mailError) {
      console.warn("[Reset Password Mail Warning] Nie udało się wysłać maila, ale hasło zostało zresetowane w bazie.", mailError);
    }

    return { success: true, tempPassword };
  } catch (e: any) {
    console.error("Błąd podczas resetu hasła:", e);
    return { success: false, error: "Błąd bazy danych przy resetowaniu hasła." };
  }
}

/**
 * Pobiera wszystkie lokale z bazy danych
 */
export async function getVenuesAction() {
  const session = await auth();
  if (!session?.user) throw new Error("Brak autoryzacji.");
  
  try {
    const results = await db.select().from(venues).orderBy(venues.name);
    return { success: true, venues: results };
  } catch (e: any) {
    console.error("Błąd podczas pobierania lokali:", e);
    return { success: false, venues: [], error: "Błąd bazy danych przy pobieraniu lokali." };
  }
}

/**
 * Zapisuje lokal (nowy lub zmiana nazwy)
 */
export async function saveVenueAction(id: number | null, name: string, colorAccent: string = '#ffd700', openingHoursConfig: string | null = null) {
  await checkAuth('settings:edit');
  if (!name || !name.trim()) return { success: false, error: "Nazwa lokalu jest wymagana." };

  try {
    if (id) {
      await db.update(venues).set({ 
        name: name.trim(),
        colorAccent: colorAccent || '#ffd700',
        openingHoursConfig: openingHoursConfig || null
      }).where(eq(venues.id, id));
      console.log(`[Settings] Zaktualizowano lokal ID: ${id} na: ${name}`);
    } else {
      await db.insert(venues).values({ 
        name: name.trim(),
        colorAccent: colorAccent || '#ffd700',
        openingHoursConfig: openingHoursConfig || null
      });
      console.log(`[Settings] Dodano nowy lokal: ${name}`);
    }
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas zapisu lokalu:", e);
    return { success: false, error: "Błąd zapisu lokalu w bazie danych (np. nazwa musi być unikalna)." };
  }
}

/**
 * Usuwa lokal z systemu, o ile nie ma do niego przypisanych aktywnych użytkowników.
 */
export async function deleteVenueAction(id: number) {
  await checkAuth('settings:edit');
  if (id === 1) {
    return { success: false, error: "Nie można usunąć głównego lokalu domyślnego." };
  }

  try {
    // Sprawdzamy czy są użytkownicy przypisani do tego lokalu
    const assignedUsers = await db.select().from(users).where(eq(users.venueId, id)).limit(1);
    if (assignedUsers.length > 0) {
      return { success: false, error: "Nie można usunąć lokalu, do którego są przypisani pracownicy. Najpierw przypisz ich do innego lokalu." };
    }

    await db.delete(venues).where(eq(venues.id, id));
    console.log(`[Settings] Usunięto lokal o ID: ${id}`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas usuwania lokalu:", e);
    return { success: false, error: "Błąd bazy danych podczas usuwania lokalu." };
  }
}

import fs from 'fs';
import path from 'path';

/**
 * Zapisuje logo firmy na dysku serwera i aktualizuje klucz site_logo w ustawieniach.
 */
export async function uploadLogoAction(formData: FormData) {
  await checkAuth('settings:edit');

  try {
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      return { success: false, error: "Nie przesłano pliku." };
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: "Dozwolone formaty: PNG, JPG, WebP, SVG." };
    }

    const ext = path.extname(file.name) || '.png';
    const fileName = `logo${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logo');
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.promises.writeFile(path.join(uploadDir, fileName), buffer);

    const logoUrl = `/uploads/logo/${fileName}`;

    const existing = await db.select().from(settings).where(eq(settings.key, 'site_logo')).limit(1);
    if (existing.length > 0) {
      await db.update(settings).set({ value: logoUrl }).where(eq(settings.key, 'site_logo'));
    } else {
      await db.insert(settings).values({ key: 'site_logo', value: logoUrl });
    }

    return { success: true, logoUrl };
  } catch (e: any) {
    console.error("Błąd podczas uploadu logo:", e);
    return { success: false, error: "Błąd zapisu pliku logo." };
  }
}

/**
  * Pobiera historię stawek płacowych danego użytkownika z salary_history
  */
export async function getUserSalaryHistoryAction(userId: number) {
  await checkAuth('settings:edit');
  try {
    const history = await db.select().from(salaryHistory).where(eq(salaryHistory.userId, userId));
    return { success: true, history };
  } catch (e: any) {
    return { success: false, history: [], error: e.message };
  }
}

/**
  * Dodaje nową stawkę płacową do historii pracownika
  */
export async function addUserSalaryRateAction(userId: number, rate: number, validFrom: string) {
  await checkAuth('settings:edit');
  try {
    if (isNaN(rate) || rate < 0) return { success: false, error: "Stawka musi być dodatnią liczbą." };
    if (!validFrom) return { success: false, error: "Data rozpoczęcia stawki jest wymagana." };

    await db.insert(salaryHistory).values({
      userId,
      hourlyRate: rate,
      validFrom,
      validTo: null
    });

    // Zaktualizuj także aktualną stawkę w tabeli users
    await db.update(users).set({ hourlyRate: rate }).where(eq(users.id, userId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  * Eksportuje pełną kopię zapasową bazy danych do obiektu JSON
  */
export async function exportDatabaseBackupAction() {
  const session = await checkAuth('settings:edit');
  if ((session.user as any).role !== 'owner') {
    return { success: false, error: "Tylko Właściciel może pobrać kopię zapasową bazy." };
  }

  try {
    const allUsers = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      position: users.position,
      hourlyRate: users.hourlyRate,
      isDemo: users.isDemo
    }).from(users);

    const allVenues = await db.select().from(venues);
    const allSchedule = await db.select().from(workSchedule);
    const allTimesheets = await db.select().from(timesheets);
    const allProducts = await db.select().from(warehouseProducts);
    const allSettings = await db.select().from(settings);

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      users: allUsers,
      venues: allVenues,
      workSchedule: allSchedule,
      timesheets: allTimesheets,
      warehouseProducts: allProducts,
      settings: allSettings
    };

    return { success: true, json: JSON.stringify(backupData, null, 2) };
  } catch (e: any) {
    console.error("Błąd podczas tworzenia kopii zapasowej:", e);
    return { success: false, error: e.message };
  }
}

/**
  * Wywołuje ponowne zasilenie danych demo
  */
export async function resetDemoDataAction() {
  await checkAuth('settings:edit');
  try {
    const { ensureDemoDataAction } = await import('./demoActions');
    const result = await ensureDemoDataAction();
    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
  * Wysyła testową wiadomość e-mail dla weryfikacji serwera SMTP
  */
export async function sendTestEmailAction(targetEmail: string) {
  const session = await checkAuth('settings:edit');
  if (!targetEmail || !targetEmail.trim()) return { success: false, error: "Podaj adres e-mail." };

  try {
    const nodemailer = (await import('nodemailer')).default;
    const smtpHost = await getSetting('smtp_host', process.env.SMTP_HOST || '');
    const smtpPort = Number(await getSetting('smtp_port', process.env.SMTP_PORT || '587'));
    const smtpUser = await getSetting('smtp_user', process.env.SMTP_USER || '');
    const smtpPass = await getSetting('smtp_pass', process.env.SMTP_PASS || '');
    const smtpFrom = await getSetting('smtp_from', process.env.SMTP_FROM || 'powiadomienia@driftpark.pl');

    if (!smtpHost || !smtpUser) {
      return { success: false, error: "Brak skonfigurowanych ustawień SMTP w systemie." };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: `"Drift Park Extreme" <${smtpFrom}>`,
      to: targetEmail.trim(),
      subject: "Testowe powiadomienie e-mail z systemu Drift Park Extreme",
      html: `
        <div style="font-family: sans-serif; padding: 20px; background: #0f0f0f; color: #fff; border-radius: 10px;">
          <h2 style="color: #ffd700;">Test SMTP Udany!</h2>
          <p>Witaj! Ta wiadomość potwierdza, że konfiguracja serwera SMTP w systemie Drift Park Extreme działa prawidłowo.</p>
          <p style="font-size: 12px; color: #888;">Test wysłany przez: ${session.user.name} (${session.user.email})</p>
        </div>
      `
    });

    return { success: true };
  } catch (e: any) {
    console.error("Błąd wysyłki e-maila testowego:", e);
    return { success: false, error: e.message };
  }
}

/**
  * Usuwa przeczytane powiadomienia starsze niż 30 dni
  */
export async function purgeReadNotificationsAction() {
  await checkAuth('settings:edit');
  try {
    const { notifications } = await import('@/db/schema');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    await db.delete(notifications).where(and(eq(notifications.isRead, true), sql`created_at < ${cutoff}`));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

