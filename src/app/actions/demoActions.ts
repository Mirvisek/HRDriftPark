'use server';

import { db } from "@/db";
import { 
  users, 
  venues, 
  warehouseCategories, 
  warehouseProducts, 
  warehouseBatches, 
  warehouseHistory, 
  shiftTasks, 
  workSchedule, 
  timesheets, 
  salaryHistory 
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Helper to get formatted dates
function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function ensureDemoDataAction() {
  try {
    // 1. Sprawdź i dodaj domyślne lokale
    let krakowId = 1;
    let katowiceId = 2;
    
    const existingVenues = await db.select().from(venues);
    if (existingVenues.length === 0) {
      console.log("[Demo Seeding] Wstawianie lokali...");
      const [insertKrakow] = await db.insert(venues).values({ id: 1, name: "Kraków Rynek" });
      const [insertKatowice] = await db.insert(venues).values({ id: 2, name: "Katowice Centrum" });
      krakowId = (insertKrakow as any).insertId || 1;
      katowiceId = (insertKatowice as any).insertId || 2;
    } else {
      krakowId = existingVenues.find(v => v.name.includes("Kraków"))?.id || existingVenues[0].id;
      katowiceId = existingVenues.find(v => v.name.includes("Katowice"))?.id || existingVenues[0].id;
    }

    // 2. Hashowanie hasła
    const hashedPassword = await bcrypt.hash("demo123", 10);

    // 3. Sprawdź i dodaj 4 konta demo
    const demoAccounts = [
      {
        email: "wlasciciel@driftpark.pl",
        firstName: "Właściciel",
        lastName: "Demo",
        displayName: "Właściciel Demo",
        role: "owner" as const,
        position: "Właściciel / Owner",
        hourlyRate: 50,
        permissions: "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,settings:edit,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage",
      },
      {
        email: "menedzer@driftpark.pl",
        firstName: "Menedżer",
        lastName: "Demo",
        displayName: "Menedżer Demo",
        role: "manager" as const,
        position: "Menedżer Zmiany",
        hourlyRate: 40,
        permissions: "schedule:view,schedule:edit,timesheet:view_own,timesheet:view_all,timesheet:edit_all,tasks:view,tasks:edit,payroll:view,users:manage,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory",
      },
      {
        email: "technik@driftpark.pl",
        firstName: "Technik",
        lastName: "Demo",
        displayName: "Technik Demo",
        role: "technik" as const,
        position: "Serwisant Gokartów",
        hourlyRate: 35,
        permissions: "schedule:view,timesheet:view_own,tasks:view,tasks:edit,push:send,inventory:view,inventory:deliver,inventory:issue,inventory:inventory,inventory:manage",
      },
      {
        email: "pracownik@driftpark.pl",
        firstName: "Pracownik",
        lastName: "Demo",
        displayName: "Pracownik Demo",
        role: "employee" as const,
        position: "Obsługa Toru",
        hourlyRate: 30,
        permissions: "schedule:view,timesheet:view_own,tasks:view,inventory:view,inventory:inventory",
      }
    ];

    const seededUsers: Record<string, number> = {};

    for (const acc of demoAccounts) {
      const existing = await db.select().from(users).where(eq(users.email, acc.email)).limit(1);
      let userId: number;
      
      if (existing.length === 0) {
        console.log(`[Demo Seeding] Tworzenie konta: ${acc.email}...`);
        const [insertRes] = await db.insert(users).values({
          firstName: acc.firstName,
          lastName: acc.lastName,
          displayName: acc.displayName,
          email: acc.email,
          password: hashedPassword,
          role: acc.role,
          position: acc.position,
          birthDate: "1995-06-20",
          mustChangePassword: false,
          hourlyRate: acc.hourlyRate,
          permissions: acc.permissions,
          isDemo: true,
          venueId: krakowId
        });
        userId = (insertRes as any).insertId || 0;

        // Wpis w salary_history
        await db.insert(salaryHistory).values({
          userId,
          hourlyRate: acc.hourlyRate,
          validFrom: "2026-01-01",
          validTo: null
        });
      } else {
        userId = existing[0].id;
        // Zaktualizuj hasło i uprawnienia, by mieć pewność poprawnego logowania demo
        await db.update(users).set({
          password: hashedPassword,
          permissions: acc.permissions,
          role: acc.role,
          venueId: krakowId
        }).where(eq(users.id, userId));
      }
      
      seededUsers[acc.role] = userId;
    }

    // 4. Kategorie magazynowe
    let catNapojeId = 1;
    let catSerwisId = 2;
    
    const existingCats = await db.select().from(warehouseCategories);
    if (existingCats.length === 0) {
      console.log("[Demo Seeding] Wstawianie kategorii magazynowych...");
      const [insNapoje] = await db.insert(warehouseCategories).values({ name: "Napoje" });
      const [insSerwis] = await db.insert(warehouseCategories).values({ name: "Części i Serwis" });
      await db.insert(warehouseCategories).values({ name: "Przekąski" });
      catNapojeId = (insNapoje as any).insertId || 1;
      catSerwisId = (insSerwis as any).insertId || 2;
    } else {
      catNapojeId = existingCats.find(c => c.name.includes("Napoje"))?.id || existingCats[0].id;
      catSerwisId = existingCats.find(c => c.name.includes("Części"))?.id || existingCats[0].id;
    }

    // 5. Produkty magazynowe
    const existingProds = await db.select().from(warehouseProducts);
    if (existingProds.length === 0) {
      console.log("[Demo Seeding] Wstawianie produktów magazynowych...");
      const prodsToSeed = [
        {
          name: "Capri Sun Multiwitamina",
          categoryId: catNapojeId,
          unit: "szt.",
          supplier: "Makro",
          minStock: 10,
          maxStock: 50,
          sku: "BEV-CAP-MULT",
          location: "Półka A1",
          hasExpiry: true,
          autoSpotCheck: true,
          status: "active" as const,
          remarks: "Dziecięcy napój Capri Sun 200ml"
        },
        {
          name: "Capri Sun Orange",
          categoryId: catNapojeId,
          unit: "szt.",
          supplier: "Makro",
          minStock: 10,
          maxStock: 50,
          sku: "BEV-CAP-ORA",
          location: "Półka A1",
          hasExpiry: true,
          autoSpotCheck: false,
          status: "active" as const,
          remarks: "Dziecięcy napój Capri Sun pomarańczowy"
        },
        {
          name: "Coca-Cola 0.5L",
          categoryId: catNapojeId,
          unit: "szt.",
          supplier: "Makro",
          minStock: 20,
          maxStock: 100,
          sku: "BEV-COKE-05",
          location: "Lodówka 1",
          hasExpiry: true,
          autoSpotCheck: false,
          status: "active" as const,
          remarks: "Klasyczna Coca-Cola w plastikowej butelce"
        },
        {
          name: "Dętka 10x2 Classic",
          categoryId: catSerwisId,
          unit: "szt.",
          supplier: "Allegro",
          minStock: 5,
          maxStock: 25,
          sku: "PART-INN-102",
          location: "Sektor B2",
          hasExpiry: false,
          autoSpotCheck: false,
          status: "active" as const,
          remarks: "Dętka do kół przednich gokartów classic"
        },
        {
          name: "Opona Torowa Drift",
          categoryId: catSerwisId,
          unit: "szt.",
          supplier: "Hurtownia opon",
          minStock: 4,
          maxStock: 15,
          sku: "PART-TYR-DRFT",
          location: "Stojak opon",
          hasExpiry: false,
          autoSpotCheck: true,
          status: "active" as const,
          remarks: "Specjalna opona driftowa o obniżonej przyczepności"
        }
      ];

      for (const p of prodsToSeed) {
        const [insertP] = await db.insert(warehouseProducts).values({
          name: p.name,
          categoryId: p.categoryId,
          unit: p.unit,
          supplier: p.supplier,
          minStock: p.minStock,
          maxStock: p.maxStock,
          sku: p.sku,
          location: p.location,
          hasExpiry: p.hasExpiry,
          autoSpotCheck: p.autoSpotCheck,
          status: p.status,
          remarks: p.remarks
        });
        const productId = (insertP as any).insertId || 0;

        if (productId > 0) {
          // Zasilenie Kraków Rynek
          const [insBatchKrakow] = await db.insert(warehouseBatches).values({
            productId,
            batchNumber: p.hasExpiry ? "PARTIA-START-KR" : "DEFAULT",
            expiryDate: p.hasExpiry ? getDateOffset(60) : null,
            quantity: p.minStock + 10,
            venueId: krakowId
          });

          await db.insert(warehouseHistory).values({
            productId,
            batchId: (insBatchKrakow as any).insertId || null,
            userId: seededUsers['owner'] || 1,
            type: "delivery",
            quantity: p.minStock + 10,
            source: p.supplier,
            remarks: "Zasilenie początkowe demo (Centrala Kraków)",
            venueId: krakowId
          });

          // Zasilenie Katowice Centrum
          const [insBatchKatowice] = await db.insert(warehouseBatches).values({
            productId,
            batchNumber: p.hasExpiry ? "PARTIA-START-KT" : "DEFAULT",
            expiryDate: p.hasExpiry ? getDateOffset(60) : null,
            quantity: p.minStock - 2 > 0 ? p.minStock - 2 : 5,
            venueId: katowiceId
          });

          await db.insert(warehouseHistory).values({
            productId,
            batchId: (insBatchKatowice as any).insertId || null,
            userId: seededUsers['owner'] || 1,
            type: "delivery",
            quantity: p.minStock - 2 > 0 ? p.minStock - 2 : 5,
            source: p.supplier,
            remarks: "Zasilenie początkowe demo (Katowice)",
            venueId: katowiceId
          });
        }
      }
    }

    // 6. Zadania zmiany (Shift Tasks)
    const existingTasks = await db.select().from(shiftTasks);
    if (existingTasks.length === 0) {
      console.log("[Demo Seeding] Wstawianie zadań zmiany...");
      const tasksToSeed = [
        {
          date: getDateOffset(0),
          title: "[MAGAZYN] Cotygodniowa pełna inwentaryzacja lokalu",
          type: "recurring" as const,
          priority: "high" as const,
          isCompleted: false,
          venueId: krakowId
        },
        {
          date: getDateOffset(0),
          title: "[SPOT CHECK] Sprawdź stan dla: Capri Sun Multiwitamina",
          type: "recurring" as const,
          priority: "medium" as const,
          isCompleted: false,
          venueId: krakowId
        },
        {
          date: getDateOffset(0),
          title: "Przegląd techniczny gokartów przed otwarciem toru",
          type: "additional" as const,
          priority: "high" as const,
          isCompleted: true,
          completedBy: seededUsers['technik'] || null,
          completedByName: "Technik Demo",
          completedAt: new Date(),
          venueId: krakowId
        },
        {
          date: getDateOffset(0),
          title: "Wyciszenie hałasu na bandzie zakrętu nr 3",
          type: "additional" as const,
          priority: "low" as const,
          isCompleted: false,
          venueId: krakowId
        }
      ];

      for (const t of tasksToSeed) {
        await db.insert(shiftTasks).values(t);
      }
    }

    // 7. Grafik pracy (Work Schedule)
    const existingSchedule = await db.select().from(workSchedule);
    if (existingSchedule.length === 0) {
      console.log("[Demo Seeding] Wstawianie grafiku...");
      const schedulesToSeed = [
        {
          date: getDateOffset(0), // dzisiaj
          leadUserId: seededUsers['employee'] || null,
          supportUserId: seededUsers['manager'] || null,
          openTime: "12:00",
          closeTime: "22:00",
          isClosed: false,
          remarks: "Obsługa rezerwacji grupowej urodzin o 17:00",
          venueId: krakowId,
          isDemo: true
        },
        {
          date: getDateOffset(1), // jutro
          leadUserId: seededUsers['employee'] || null,
          supportUserId: seededUsers['technik'] || null,
          openTime: "10:00",
          closeTime: "21:00",
          isClosed: false,
          remarks: "Standardowy dzień operacyjny",
          venueId: krakowId,
          isDemo: true
        },
        {
          date: getDateOffset(2), // pojutrze
          leadUserId: seededUsers['manager'] || null,
          supportUserId: seededUsers['employee'] || null,
          openTime: "12:00",
          closeTime: "22:00",
          isClosed: false,
          remarks: "Trening sekcji gokartowej",
          venueId: krakowId,
          isDemo: true
        }
      ];

      for (const s of schedulesToSeed) {
        await db.insert(workSchedule).values(s);
      }
    }

    // 8. Rejestr czasu pracy (Timesheets)
    const existingTimesheets = await db.select().from(timesheets);
    if (existingTimesheets.length === 0) {
      console.log("[Demo Seeding] Wstawianie RCP...");
      const timesheetsToSeed = [
        {
          userId: seededUsers['employee'] || 1,
          date: getDateOffset(-2),
          startTime: "12:05",
          endTime: "22:15",
          remarks: "Zakończenie zmiany i liczenie kasy",
          isLocked: true,
          isDemo: true
        },
        {
          userId: seededUsers['employee'] || 1,
          date: getDateOffset(-1),
          startTime: "11:55",
          endTime: "21:05",
          remarks: "Wydanie napojów do lodówki",
          isLocked: false,
          isDemo: true
        },
        {
          userId: seededUsers['manager'] || 1,
          date: getDateOffset(-1),
          startTime: "12:00",
          endTime: "22:10",
          remarks: "Wsparcie zmiany i zamknięcie obiektu",
          isLocked: false,
          isDemo: true
        }
      ];

      for (const t of timesheetsToSeed) {
        await db.insert(timesheets).values(t);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Demo Seeding Error]", err);
    return { success: false, error: err.message };
  }
}
