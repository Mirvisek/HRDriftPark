'use server';

import { db } from "@/db";
import { shiftCashReconciliations, timesheets, users, warehouseProducts, warehouseBatches } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/auth";

export async function getOwnerAnalyticsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  const isDemo = (session.user as any).isDemo === true;

  try {
    // 1. Sumaryczny przychód i obrót gotówkowy z kasy
    const cashStats = await db
      .select({
        totalFiscal: sql<number>`COALESCE(SUM(fiscal_report), 0)`,
        totalTerminal: sql<number>`COALESCE(SUM(terminal_report), 0)`,
        totalBlik: sql<number>`COALESCE(SUM(blik_report), 0)`,
        totalCash: sql<number>`COALESCE(SUM(cash_to_bag), 0)`
      })
      .from(shiftCashReconciliations)
      .where(eq(shiftCashReconciliations.isDemo, isDemo));

    // 2. Koszt pracy (Payroll)
    const allUsers = await db.select().from(users).where(eq(users.isDemo, isDemo));
    const allSheets = await db.select().from(timesheets).where(eq(timesheets.isDemo, isDemo));

    let totalLaborCost = 0;
    allSheets.forEach(t => {
      const u = allUsers.find(user => user.id === t.userId);
      const [sh, sm] = t.startTime.split(':').map(Number);
      const [eh, em] = t.endTime.split(':').map(Number);
      let diffSec = (eh * 3600 + em * 60) - (sh * 3600 + sm * 60);
      if (diffSec <= 0) diffSec += 86400;

      const rate = u ? u.hourlyRate : 0;
      totalLaborCost += (diffSec / 3600) * rate;
    });

    // 3. Stany magazynowe
    const stockStats = await db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        totalBatchesQty: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE is_demo = ${isDemo ? 1 : 0}), 0)`
      })
      .from(warehouseProducts)
      .where(eq(warehouseProducts.isDemo, isDemo));

    const totalRevenue = (cashStats[0]?.totalFiscal || 0) + (cashStats[0]?.totalTerminal || 0) + (cashStats[0]?.totalBlik || 0);

    return {
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalLaborCost: Math.round(totalLaborCost * 100) / 100,
        totalCashToBag: Math.round((cashStats[0]?.totalCash || 0) * 100) / 100,
        laborCostPercentage: totalRevenue > 0 ? Math.round((totalLaborCost / totalRevenue) * 100) : 0,
        totalProducts: stockStats[0]?.totalProducts || 0,
        totalStockQuantity: stockStats[0]?.totalBatchesQty || 0
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
