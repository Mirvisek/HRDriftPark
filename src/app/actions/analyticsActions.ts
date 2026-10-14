'use server';

import { db } from "@/db";
import { shiftCashReconciliations, timesheets, users, warehouseProducts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

export async function getOwnerAnalyticsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Brak autoryzacji" };

  if (!hasPermission(session.user, 'payroll:view') && (session.user as any).role !== 'owner') {
    return { success: false, error: "Brak uprawnień do analityki finansowej." };
  }

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

    const [laborRow] = await db
      .select({
        total: sql<number>`COALESCE(SUM(
          (
            CASE
              WHEN TIME_TO_SEC(${timesheets.endTime}) > TIME_TO_SEC(${timesheets.startTime})
              THEN TIME_TO_SEC(${timesheets.endTime}) - TIME_TO_SEC(${timesheets.startTime})
              ELSE TIME_TO_SEC(${timesheets.endTime}) - TIME_TO_SEC(${timesheets.startTime}) + 86400
            END
          ) / 3600 * ${users.hourlyRate}
        ), 0)`,
      })
      .from(timesheets)
      .innerJoin(users, eq(timesheets.userId, users.id))
      .where(eq(timesheets.isDemo, isDemo));

    const totalLaborCost = Number(laborRow?.total || 0);

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
    console.error("Błąd analityki:", e);
    return { success: false, error: "Nie udało się policzyć analityki." };
  }
}
