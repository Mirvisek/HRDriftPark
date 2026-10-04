import { db } from "@/db";
import {
  warehouseInventories,
  warehouseInventoryItems,
  warehouseProducts,
  users,
  shiftTasks,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Internal spot-check generator — not a Server Action.
 * Call only from authenticated server code paths.
 */
export async function runDailySpotCheck(
  dateStr: string,
  venueId: number,
  isDemo: boolean,
  fallbackUserId: number
) {
  const existing = await db
    .select()
    .from(warehouseInventories)
    .where(
      and(
        eq(warehouseInventories.type, "spot"),
        eq(warehouseInventories.venueId, venueId),
        eq(warehouseInventories.isDemo, isDemo),
        sql`DATE(created_at) = ${dateStr}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { success: true as const, alreadyExists: true, inventoryId: existing[0].id };
  }

  const spotCheckProducts = await db
    .select({
      id: warehouseProducts.id,
      name: warehouseProducts.name,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id} AND venue_id = ${venueId} AND is_demo = ${isDemo ? 1 : 0}), 0)`,
    })
    .from(warehouseProducts)
    .where(
      and(
        eq(warehouseProducts.status, "active"),
        eq(warehouseProducts.autoSpotCheck, true),
        eq(warehouseProducts.isDemo, isDemo)
      )
    );

  if (spotCheckProducts.length === 0) {
    return {
      success: true as const,
      reason: "Brak produktów oznaczonych do automatycznej inwentaryzacji.",
    };
  }

  const shuffled = [...spotCheckProducts].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);

  const defaultAdmin = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.role, "owner"),
        eq(users.venueId, venueId),
        eq(users.isDemo, isDemo)
      )
    )
    .limit(1);
  const systemUserId = defaultAdmin.length > 0 ? defaultAdmin[0].id : fallbackUserId;

  const [insertInv] = await db.insert(warehouseInventories).values({
    userId: systemUserId,
    type: "spot",
    status: "draft",
    createdAt: new Date(dateStr + "T08:00:00"),
    venueId,
    isDemo,
  });
  const inventoryId = (insertInv as any).insertId || 0;

  for (const p of selected) {
    await db.insert(warehouseInventoryItems).values({
      inventoryId,
      productId: p.id,
      systemStock: p.currentStock,
      actualStock: null,
      difference: null,
    });
  }

  const productNames = selected.map((p) => p.name).join(", ");
  await db.insert(shiftTasks).values({
    date: dateStr,
    title: `[MAGAZYN] Inwentaryzacja wybiórcza: Sprawdź stan dla: ${productNames}`,
    type: "recurring",
    priority: "high",
    isCompleted: false,
    isDemo,
    venueId,
  });

  console.log(
    `[SpotCheck] Wygenerowano automatyczną inwentaryzację ID: ${inventoryId} dla lokalu ID: ${venueId} na dzień ${dateStr}`
  );
  return { success: true as const, inventoryId };
}
