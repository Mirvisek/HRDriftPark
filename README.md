# Drift Park Extreme — Portal HR / Operacje

System zarządzania personelem i operacjami lokalu **Drift Park Extreme**: dyspozycyjność, grafik, RCP, zmiany dzienne, checklisty, zadania, magazyn, wydarzenia, alerty, payroll i ustawienia.

## Stack

- **Next.js 16** (App Router) + React 19 + Tailwind 4
- **NextAuth v5** (Credentials / JWT)
- **MySQL** + Drizzle ORM
- **Server Actions** (główny backend; HTTP API tylko `/api/auth` i `/api/shift`)
- PDF (`@react-pdf/renderer`), Excel (`exceljs`), Web Push, Nodemailer, node-cron

## Wymagania

- Node.js 20+
- MySQL 8+
- Zmienne środowiskowe (patrz niżej)

## Szybki start

```bash
cp .env.example .env   # jeśli dostępny; albo utwórz .env ręcznie
npm install --legacy-peer-deps
npm run db:safe-migrate
npm run db:seed        # tylko lokalnie — nie w produkcji bez ALLOW_PROD_SEED=true
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

## Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `DATABASE_URL` | Połączenie MySQL (`mysql://user:pass@host:3306/db`) — **wymagane w produkcji** |
| `AUTH_SECRET` | Sekret JWT NextAuth — **wymagane w produkcji** (losowy, długi) |
| `NEXTAUTH_URL` / `AUTH_URL` | Publiczny URL aplikacji (np. `https://hrdriftpark.pl`) |
| `AUTH_TRUST_HOST` | Opcjonalnie `true` za reverse proxy |
| `SMTP_*` | Opcjonalnie; SMTP można też skonfigurować w panelu Ustawienia |

## Role i dostęp

| Rola | Typowy zakres |
|---|---|
| `owner` | Pełny dostęp |
| `manager` | Grafik, RCP wszystkich, payroll, użytkownicy, operacje |
| `technik` | Zadania, magazyn, push |
| `employee` | Własna dyspozycyjność / timesheet, zadania, podgląd |

Uprawnienia granularne: `src/lib/permissions.ts` (`schedule:*`, `timesheet:*`, `inventory:*`, …).

## Struktura projektu

```
src/
  app/
    login, change-password, reset-password
    (portal)/          # zalogowany portal (dashboard, today, schedule, magazyn, settings…)
    actions/           # Server Actions
    api/auth, api/shift
  components/          # shell, PDF, warehouse modules
  db/                  # schema, seed, safe-migrate
  lib/                 # authz, validation, cron, payroll, excel…
  services/anomalyEngine/
```

## Skrypty

| Komenda | Opis |
|---|---|
| `npm run dev` | Serwer deweloperski |
| `npm run build` / `start` | Produkcja |
| `npm test` | Vitest |
| `npm run db:safe-migrate` | Bezpieczna migracja schematu (m.in. `session_version`) |
| `npm run db:seed` | Konta testowe (tylko puste/nowe e-maile; nie nadpisuje haseł) |

## Deploy — checklista bezpieczeństwa

1. Ustaw mocne `AUTH_SECRET`, `DATABASE_URL`, `NEXTAUTH_URL`
2. Uruchom `npm run db:safe-migrate`
3. **Nie** uruchamiaj seeda w produkcji (chyba że świadomie `ALLOW_PROD_SEED=true`)
4. Skonfiguruj SMTP w Ustawieniach lub env
5. Zweryfikuj Web Push (VAPID) jeśli używasz powiadomień

## Uwagi dla agentów / AI

Ten projekt używa **Next.js z breaking changes** względem klasycznych tutoriali. Przed pisaniem kodu sprawdź dokumentację w `node_modules/next/dist/docs/` oraz `AGENTS.md`.

## Licencja

Private — Drift Park Extreme.
