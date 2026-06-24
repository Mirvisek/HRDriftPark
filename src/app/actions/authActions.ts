'use server';

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendMail } from "@/lib/mail";

/**
 * Zmienia hasło zalogowanego użytkownika (używane przy wymuszonej zmianie przy pierwszym logowaniu)
 */
export async function changePasswordAction(password: string) {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: "Brak autoryzacji. Zaloguj się ponownie." };
  }

  if (!password || password.length < 6) {
    return { success: false, error: "Hasło musi mieć co najmniej 6 znaków." };
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db
      .update(users)
      .set({
        password: hashedPassword,
        mustChangePassword: false,
      })
      .where(eq(users.email, session.user.email));

    console.log(`[Auth] Pomyślnie zmieniono hasło (wymuszone) dla użytkownika: ${session.user.email}`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas zmiany hasła:", e);
    return { success: false, error: "Błąd serwera przy zmianie hasła." };
  }
}

/**
 * Inicjuje procedurę odzyskiwania hasła (zapomniane hasło).
 * Weryfikuje e-mail oraz datę urodzenia użytkownika.
 */
export async function forgotPasswordAction(email: string, birthDate: string) {
  if (!email || !birthDate) {
    return { success: false, error: "E-mail oraz data urodzenia są wymagane." };
  }

  const successMessage = "Link do restartu hasła został wysłany! Jeżeli nie posiadasz konta skontaktuj się z administratorem!";

  try {
    // Wyszukanie użytkownika o danym e-mailu i dacie urodzenia
    const dbUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email.trim()),
          eq(users.birthDate, birthDate.trim())
        )
      )
      .limit(1);

    if (dbUsers.length === 0) {
      // Bezpieczeństwo: Nie ujawniamy informacji czy email/data urodzenia są poprawne
      console.log(`[Auth Forgot] Próba odzyskania hasła dla nieistniejącego konta lub z błędną datą urodzenia: ${email} (${birthDate})`);
      return { success: true, message: successMessage };
    }

    const user = dbUsers[0];
    
    // Generowanie bezpiecznego tokenu resetującego
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 godzina ważności

    // Zapis tokenu w bazie danych
    await db
      .update(users)
      .set({
        resetToken: token,
        resetTokenExpires: tokenExpires
      })
      .where(eq(users.id, user.id));

    // Przygotowanie linku resetującego
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    console.log(`[Auth Forgot] Wygenerowano token resetu dla ${email}. Wysyłanie e-maila...`);

    // Przygotowanie treści e-maila
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f0f0f; color: #e0e0e0; border-radius: 10px; border: 1px solid #ffaa00;">
        <h2 style="color: #ffd700; border-bottom: 1px solid #333; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Drift Park Extreme</h2>
        <p style="font-size: 16px;">Witaj, <strong>${user.displayName}</strong>!</p>
        <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0;">Zgłoszono prośbę o zresetowanie hasła do Twojego konta w panelu Drift Park Extreme.</p>
        <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0;">Aby ustawić nowe hasło, kliknij w poniższy przycisk (link jest ważny przez 1 godzinę):</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #ffaa00; color: #0f0f0f; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 12px rgba(255, 170, 0, 0.2);">Zresetuj hasło</a>
        </div>
        <p style="font-size: 12px; color: #555; border-top: 1px solid #222; padding-top: 15px;">
          Jeżeli nie prosiłeś o resetowanie hasła, możesz zignorować tę wiadomość. Twoje obecne hasło pozostanie niezmienione.<br/>
          Link: <a href="${resetLink}" style="color: #ffaa00; text-decoration: underline;">${resetLink}</a>
        </p>
      </div>
    `;

    // Wysyłka wiadomości
    await sendMail({
      to: user.email,
      subject: "Drift Park Extreme - Resetowanie Hasła",
      html: emailHtml
    });

    return { success: true, message: successMessage };
  } catch (e: any) {
    console.error("Błąd podczas resetu hasła (Forgot Password):", e);
    return { success: false, error: "Błąd serwera podczas generowania linku resetującego." };
  }
}

/**
 * Wykonuje reset hasła przy użyciu tokenu.
 */
export async function resetPasswordAction(token: string, password: string) {
  if (!token || !password) {
    return { success: false, error: "Token oraz nowe hasło są wymagane." };
  }

  if (password.length < 6) {
    return { success: false, error: "Hasło musi mieć co najmniej 6 znaków." };
  }

  try {
    // Wyszukanie użytkownika z ważnym tokenem
    const now = new Date();
    const dbUsers = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);

    if (dbUsers.length === 0) {
      return { success: false, error: "Token jest nieprawidłowy lub wygasł." };
    }

    const user = dbUsers[0];

    // Sprawdzenie wygaśnięcia tokenu
    if (user.resetTokenExpires && user.resetTokenExpires < now) {
      return { success: false, error: "Token resetujący hasło wygasł. Poproś o nowy link." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Aktualizacja hasła i usunięcie tokenów
    await db
      .update(users)
      .set({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        mustChangePassword: false, // Użytkownik sam zresetował hasło, nie wymuszamy kolejnej zmiany
      })
      .where(eq(users.id, user.id));

    console.log(`[Auth Reset] Pomyślnie zresetowano hasło dla użytkownika o ID ${user.id} (${user.email})`);
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas resetowania hasła (Reset Password):", e);
    return { success: false, error: "Błąd serwera podczas resetowania hasła." };
  }
}
