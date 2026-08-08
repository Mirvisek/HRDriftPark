'use server';

import { db } from "@/db";
import { 
  warehouseCategories, 
  warehouseProducts, 
  warehouseBatches, 
  warehouseHistory, 
  warehouseInventories, 
  warehouseInventoryItems,
  users,
  shiftTasks
} from "@/db/schema";
import { eq, and, asc, desc, sql, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";

// Pomocnik weryfikacji uprawnień na serwerze
async function checkAuth(permission?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Brak autoryzacji.");
  if (permission && !hasPermission(session.user, permission as any)) {
    throw new Error(`Brak wymaganych uprawnień: ${permission}`);
  }
  return session;
}

// -------------------------------------------------------------
// KATEGORIE
// -------------------------------------------------------------

export async function getCategoriesAction() {
  await checkAuth('inventory:view');
  try {
    const data = await db.select().from(warehouseCategories).orderBy(asc(warehouseCategories.name));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveCategoryAction(id: number | null, name: string) {
  await checkAuth('inventory:manage');
  try {
    if (!name.trim()) return { success: false, error: "Nazwa kategorii nie może być pusta." };
    if (id) {
      await db.update(warehouseCategories).set({ name: name.trim() }).where(eq(warehouseCategories.id, id));
    } else {
      await db.insert(warehouseCategories).values({ name: name.trim() });
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// PRODUKTY
// -------------------------------------------------------------

export async function getProductsAction() {
  await checkAuth('inventory:view');
  try {
    const products = await db.select({
      id: warehouseProducts.id,
      name: warehouseProducts.name,
      categoryId: warehouseProducts.categoryId,
      categoryName: warehouseCategories.name,
      supplier: warehouseProducts.supplier,
      unit: warehouseProducts.unit,
      minStock: warehouseProducts.minStock,
      maxStock: warehouseProducts.maxStock,
      sku: warehouseProducts.sku,
      location: warehouseProducts.location,
      hasExpiry: warehouseProducts.hasExpiry,
      autoSpotCheck: warehouseProducts.autoSpotCheck,
      status: warehouseProducts.status,
      remarks: warehouseProducts.remarks,
      createdAt: warehouseProducts.createdAt,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id}), 0)`
    })
    .from(warehouseProducts)
    .leftJoin(warehouseCategories, eq(warehouseProducts.categoryId, warehouseCategories.id))
    .orderBy(asc(warehouseProducts.name));
    
    return { success: true, data: products };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function addProductAction(productData: any) {
  await checkAuth('inventory:manage');
  try {
    if (!productData.name?.trim()) return { success: false, error: "Nazwa produktu jest wymagana." };
    if (!productData.categoryId) return { success: false, error: "Kategoria jest wymagana." };

    const [insertResult] = await db.insert(warehouseProducts).values({
      name: productData.name.trim(),
      categoryId: Number(productData.categoryId),
      supplier: productData.supplier?.trim() || null,
      unit: productData.unit || 'szt.',
      minStock: Number(productData.minStock || 0),
      maxStock: Number(productData.maxStock || 0),
      sku: productData.sku?.trim() || null,
      location: productData.location?.trim() || null,
      hasExpiry: !!productData.hasExpiry,
      autoSpotCheck: !!productData.autoSpotCheck,
      status: productData.status || 'active',
      remarks: productData.remarks?.trim() || null
    });
    
    const productId = (insertResult as any).insertId || 0;
    
    // Automatycznie wstawiamy domyślną partię dla produktów bez terminu ważności
    if (!productData.hasExpiry) {
      await db.insert(warehouseBatches).values({
        productId,
        batchNumber: 'DEFAULT',
        expiryDate: null,
        quantity: 0
      });
    }
    
    return { success: true, productId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateProductAction(id: number, productData: any) {
  await checkAuth('inventory:manage');
  try {
    if (!productData.name?.trim()) return { success: false, error: "Nazwa produktu jest wymagana." };
    if (!productData.categoryId) return { success: false, error: "Kategoria jest wymagana." };

    const existing = await db.select().from(warehouseProducts).where(eq(warehouseProducts.id, id)).limit(1);
    if (existing.length === 0) return { success: false, error: "Produkt nie istnieje." };
    
    const wasExpiry = existing[0].hasExpiry;
    const isExpiry = !!productData.hasExpiry;
    
    await db.update(warehouseProducts).set({
      name: productData.name.trim(),
      categoryId: Number(productData.categoryId),
      supplier: productData.supplier?.trim() || null,
      unit: productData.unit || 'szt.',
      minStock: Number(productData.minStock || 0),
      maxStock: Number(productData.maxStock || 0),
      sku: productData.sku?.trim() || null,
      location: productData.location?.trim() || null,
      hasExpiry: isExpiry,
      autoSpotCheck: !!productData.autoSpotCheck,
      status: productData.status || 'active',
      remarks: productData.remarks?.trim() || null
    })
    .where(eq(warehouseProducts.id, id));
    
    // Konwersja partii przy zmianie trybu terminu ważności
    if (wasExpiry && !isExpiry) {
      // Przejście z ważności na brak terminu ważności: łączymy partie w jedną DEFAULT
      const hasDefault = await db.select().from(warehouseBatches).where(and(eq(warehouseBatches.productId, id), eq(warehouseBatches.batchNumber, 'DEFAULT'))).limit(1);
      if (hasDefault.length === 0) {
        const activeBatches = await db.select().from(warehouseBatches).where(eq(warehouseBatches.productId, id));
        const sumQty = activeBatches.reduce((acc, b) => acc + b.quantity, 0);
        
        await db.insert(warehouseBatches).values({
          productId: id,
          batchNumber: 'DEFAULT',
          expiryDate: null,
          quantity: sumQty
        });
        
        await db.delete(warehouseBatches).where(and(eq(warehouseBatches.productId, id), sql`batch_number != 'DEFAULT'`));
      }
    } else if (!wasExpiry && isExpiry) {
      // Przejście z braku ważności na z ważnością: zmieniamy nazwę DEFAULT na PARTIA-A
      await db.update(warehouseBatches)
        .set({ batchNumber: 'PARTIA-A' })
        .where(and(eq(warehouseBatches.productId, id), eq(warehouseBatches.batchNumber, 'DEFAULT')));
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteProductAction(id: number) {
  await checkAuth('inventory:manage');
  try {
    // Dezaktywacja zamiast twardego usuwania ze względu na spójność historii operacji
    await db.update(warehouseProducts)
      .set({ status: 'inactive' })
      .where(eq(warehouseProducts.id, id));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// OPERACJE: DOSTAWY I WYDANIA
// -------------------------------------------------------------

export async function deliverProductAction(data: {
  productId: number;
  quantity: number;
  supplier?: string;
  remarks?: string;
  batchNumber?: string;
  expiryDate?: string;
  documentNumber?: string;
}) {
  const session = await checkAuth('inventory:deliver');
  const userId = Number((session.user as any).id);
  
  try {
    const qty = Number(data.quantity);
    if (isNaN(qty) || qty <= 0) return { success: false, error: "Ilość musi być większa od zera." };
    
    const product = await db.select().from(warehouseProducts).where(eq(warehouseProducts.id, data.productId)).limit(1);
    if (product.length === 0) return { success: false, error: "Produkt nie istnieje." };
    
    let batchId: number | null = null;
    
    if (product[0].hasExpiry) {
      const bNum = data.batchNumber?.trim() || 'PARTIA-' + new Date().toISOString().split('T')[0];
      const expDate = data.expiryDate || null;
      
      const existingBatch = await db.select()
        .from(warehouseBatches)
        .where(and(
          eq(warehouseBatches.productId, data.productId),
          eq(warehouseBatches.batchNumber, bNum)
        ))
        .limit(1);
        
      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
        await db.update(warehouseBatches)
          .set({ quantity: existingBatch[0].quantity + qty })
          .where(eq(warehouseBatches.id, batchId));
      } else {
        const [insertBatch] = await db.insert(warehouseBatches).values({
          productId: data.productId,
          batchNumber: bNum,
          expiryDate: expDate,
          quantity: qty
        });
        batchId = (insertBatch as any).insertId || null;
      }
    } else {
      const existingBatch = await db.select()
        .from(warehouseBatches)
        .where(and(
          eq(warehouseBatches.productId, data.productId),
          eq(warehouseBatches.batchNumber, 'DEFAULT')
        ))
        .limit(1);
        
      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id;
        await db.update(warehouseBatches)
          .set({ quantity: existingBatch[0].quantity + qty })
          .where(eq(warehouseBatches.id, batchId));
      } else {
        const [insertBatch] = await db.insert(warehouseBatches).values({
          productId: data.productId,
          batchNumber: 'DEFAULT',
          expiryDate: null,
          quantity: qty
        });
        batchId = (insertBatch as any).insertId || null;
      }
    }
    
    await db.insert(warehouseHistory).values({
      productId: data.productId,
      batchId,
      userId,
      type: 'delivery',
      quantity: qty,
      source: data.supplier?.trim() || 'Dostawca Zewnętrzny',
      remarks: data.remarks?.trim() || (data.documentNumber ? `Faktura/Dokument: ${data.documentNumber}` : null)
    });
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function issueProductAction(data: {
  productId: number;
  quantity: number;
  venue: string;
  remarks?: string;
}) {
  const session = await checkAuth('inventory:issue');
  const userId = Number((session.user as any).id);
  
  try {
    const qty = Number(data.quantity);
    if (isNaN(qty) || qty <= 0) return { success: false, error: "Ilość musi być większa od zera." };
    if (!data.venue?.trim()) return { success: false, error: "Nazwa lokalu docelowego jest wymagana." };
    
    const product = await db.select().from(warehouseProducts).where(eq(warehouseProducts.id, data.productId)).limit(1);
    if (product.length === 0) return { success: false, error: "Produkt nie istnieje." };
    
    const batches = await db.select()
      .from(warehouseBatches)
      .where(eq(warehouseBatches.productId, data.productId))
      .orderBy(asc(warehouseBatches.expiryDate), asc(warehouseBatches.id)); // FEFO
       
    const totalAvailable = batches.reduce((acc, b) => acc + b.quantity, 0);
    if (totalAvailable < qty) {
      return { success: false, error: `Niewystarczający stan magazynowy. Dostępne: ${totalAvailable} ${product[0].unit}, żądano: ${qty} ${product[0].unit}.` };
    }
    
    let remainingToIssue = qty;
    
    for (const batch of batches) {
      if (remainingToIssue <= 0) break;
      if (batch.quantity <= 0) continue;
      
      const issueFromThisBatch = Math.min(batch.quantity, remainingToIssue);
      
      await db.update(warehouseBatches)
        .set({ quantity: batch.quantity - issueFromThisBatch })
        .where(eq(warehouseBatches.id, batch.id));
         
      await db.insert(warehouseHistory).values({
        productId: data.productId,
        batchId: batch.id,
        userId,
        type: 'issue',
        quantity: -issueFromThisBatch,
        source: data.venue.trim(),
        remarks: data.remarks?.trim() || null
      });
      
      remainingToIssue -= issueFromThisBatch;
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// INWENTARYZACJE (PEŁNA I WYBIÓRCZA)
// -------------------------------------------------------------

export async function startInventoryAction(categoryId: number | null) {
  const session = await checkAuth('inventory:inventory');
  const userId = Number((session.user as any).id);
  
  try {
    const activeDraft = await db.select()
      .from(warehouseInventories)
      .where(eq(warehouseInventories.status, 'draft'))
      .limit(1);
       
    if (activeDraft.length > 0) {
      return { success: false, error: "Istnieje już otwarta inwentaryzacja robocza. Dokończ ją lub anuluj przed rozpoczęciem nowej.", inventoryId: activeDraft[0].id };
    }
    
    const [insertInv] = await db.insert(warehouseInventories).values({
      userId,
      categoryId,
      type: 'full',
      status: 'draft'
    });
    
    const inventoryId = (insertInv as any).insertId || 0;
    
    const conditions = [eq(warehouseProducts.status, 'active')];
    if (categoryId) {
      conditions.push(eq(warehouseProducts.categoryId, categoryId));
    }
    
    const products = await db.select({
      id: warehouseProducts.id,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id}), 0)`
    })
    .from(warehouseProducts)
    .where(and(...conditions));
    
    for (const p of products) {
      await db.insert(warehouseInventoryItems).values({
        inventoryId,
        productId: p.id,
        systemStock: p.currentStock,
        actualStock: null,
        difference: null
      });
    }
    
    return { success: true, inventoryId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveInventoryDraftAction(inventoryId: number, items: { productId: number; actualStock: number; remarks?: string }[]) {
  await checkAuth('inventory:inventory');
  try {
    for (const item of items) {
      const dbItem = await db.select()
        .from(warehouseInventoryItems)
        .where(and(
          eq(warehouseInventoryItems.inventoryId, inventoryId),
          eq(warehouseInventoryItems.productId, item.productId)
        ))
        .limit(1);
         
      if (dbItem.length > 0) {
        const sys = dbItem[0].systemStock;
        const act = Number(item.actualStock);
        const diff = act - sys;
        
        await db.update(warehouseInventoryItems)
          .set({
            actualStock: act,
            difference: diff,
            remarks: item.remarks?.trim() || null
          })
          .where(eq(warehouseInventoryItems.id, dbItem[0].id));
      }
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function submitInventoryAction(inventoryId: number, items: { productId: number; actualStock: number; remarks?: string }[]) {
  const session = await checkAuth('inventory:inventory');
  const userId = Number((session.user as any).id);
  
  try {
    const inv = await db.select().from(warehouseInventories).where(eq(warehouseInventories.id, inventoryId)).limit(1);
    if (inv.length === 0) return { success: false, error: "Inwentaryzacja nie istnieje." };
    if (inv[0].status === 'submitted') return { success: false, error: "Ta inwentaryzacja została już zatwierdzona." };
    
    await saveInventoryDraftAction(inventoryId, items);
    
    const dbItems = await db.select()
      .from(warehouseInventoryItems)
      .where(eq(warehouseInventoryItems.inventoryId, inventoryId));
      
    for (const item of dbItems) {
      if (item.actualStock === null || item.difference === null) continue;
      if (item.difference === 0) continue;
      
      const diff = item.difference;
      const productId = item.productId;
      
      const activeBatches = await db.select()
        .from(warehouseBatches)
        .where(eq(warehouseBatches.productId, productId))
        .orderBy(desc(warehouseBatches.id));
        
      if (activeBatches.length === 0) continue;
      
      if (diff > 0) {
        const targetBatch = activeBatches[0];
        await db.update(warehouseBatches)
          .set({ quantity: targetBatch.quantity + diff })
          .where(eq(warehouseBatches.id, targetBatch.id));
          
        await db.insert(warehouseHistory).values({
          productId,
          batchId: targetBatch.id,
          userId,
          type: 'correction',
          quantity: diff,
          source: `Inwentaryzacja ID: ${inventoryId}`,
          remarks: item.remarks || 'Korekta inwentaryzacyjna (nadwyżka)'
        });
      } else {
        let remainingToSubtract = Math.abs(diff);
        const sortedBatches = [...activeBatches].sort((a, b) => {
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });
        
        for (const batch of sortedBatches) {
          if (remainingToSubtract <= 0) break;
          if (batch.quantity <= 0) continue;
          
          const subtractFromThis = Math.min(batch.quantity, remainingToSubtract);
          await db.update(warehouseBatches)
            .set({ quantity: batch.quantity - subtractFromThis })
            .where(eq(warehouseBatches.id, batch.id));
            
          await db.insert(warehouseHistory).values({
            productId,
            batchId: batch.id,
            userId,
            type: 'correction',
            quantity: -subtractFromThis,
            source: `Inwentaryzacja ID: ${inventoryId}`,
            remarks: item.remarks || 'Korekta inwentaryzacyjna (niedobór)'
          });
          
          remainingToSubtract -= subtractFromThis;
        }
        
        if (remainingToSubtract > 0) {
          const targetBatch = sortedBatches[0];
          await db.update(warehouseBatches)
            .set({ quantity: targetBatch.quantity - remainingToSubtract })
            .where(eq(warehouseBatches.id, targetBatch.id));
            
          await db.insert(warehouseHistory).values({
            productId,
            batchId: targetBatch.id,
            userId,
            type: 'correction',
            quantity: -remainingToSubtract,
            source: `Inwentaryzacja ID: ${inventoryId}`,
            remarks: item.remarks || 'Korekta inwentaryzacyjna (niedobór poniżej zera)'
          });
        }
      }
    }
    
    await db.update(warehouseInventories)
      .set({ status: 'submitted' })
      .where(eq(warehouseInventories.id, inventoryId));
      
    // Zamykanie zadania w grafik-checklist jeśli inwentaryzacja była wybiórcza
    if (inv[0].type === 'spot') {
      const todayStr = new Date().toISOString().split('T')[0];
      const execUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const userName = execUser.length > 0 ? execUser[0].displayName : 'Pracownik';
      
      await db.update(shiftTasks)
        .set({ 
          isCompleted: true,
          completedBy: userId,
          completedByName: userName,
          completedAt: new Date()
        })
        .where(and(
          eq(shiftTasks.date, todayStr),
          sql`title LIKE '%Inwentaryzacja wybiórcza%'`
        ));
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getInventoryHistoryAction() {
  await checkAuth('inventory:view');
  try {
    const data = await db.select({
      id: warehouseInventories.id,
      date: warehouseInventories.createdAt,
      type: warehouseInventories.type,
      status: warehouseInventories.status,
      userName: users.displayName,
      categoryName: warehouseCategories.name,
      itemCount: sql<number>`(SELECT COUNT(*) FROM warehouse_inventory_items WHERE inventory_id = ${warehouseInventories.id})`,
      diffCount: sql<number>`(SELECT COUNT(*) FROM warehouse_inventory_items WHERE inventory_id = ${warehouseInventories.id} AND COALESCE(difference, 0) != 0)`
    })
    .from(warehouseInventories)
    .leftJoin(users, eq(warehouseInventories.userId, users.id))
    .leftJoin(warehouseCategories, eq(warehouseInventories.categoryId, warehouseCategories.id))
    .orderBy(desc(warehouseInventories.createdAt));
    
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getInventoryDetailsAction(id: number) {
  await checkAuth('inventory:view');
  try {
    const header = await db.select({
      id: warehouseInventories.id,
      date: warehouseInventories.createdAt,
      type: warehouseInventories.type,
      status: warehouseInventories.status,
      userName: users.displayName,
      categoryName: warehouseCategories.name
    })
    .from(warehouseInventories)
    .leftJoin(users, eq(warehouseInventories.userId, users.id))
    .leftJoin(warehouseCategories, eq(warehouseInventories.categoryId, warehouseCategories.id))
    .where(eq(warehouseInventories.id, id))
    .limit(1);
    
    if (header.length === 0) return { success: false, error: "Nie znaleziono inwentaryzacji." };
    
    const items = await db.select({
      id: warehouseInventoryItems.id,
      productId: warehouseInventoryItems.productId,
      productName: warehouseProducts.name,
      unit: warehouseProducts.unit,
      systemStock: warehouseInventoryItems.systemStock,
      actualStock: warehouseInventoryItems.actualStock,
      difference: warehouseInventoryItems.difference,
      remarks: warehouseInventoryItems.remarks
    })
    .from(warehouseInventoryItems)
    .leftJoin(warehouseProducts, eq(warehouseInventoryItems.productId, warehouseProducts.id))
    .where(eq(warehouseInventoryItems.inventoryId, id))
    .orderBy(asc(warehouseProducts.name));
    
    return { success: true, header: header[0], items };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function cancelInventoryAction(inventoryId: number) {
  await checkAuth('inventory:inventory');
  try {
    const inv = await db.select().from(warehouseInventories).where(eq(warehouseInventories.id, inventoryId)).limit(1);
    if (inv.length === 0) return { success: false, error: "Nie znaleziono inwentaryzacji." };
    if (inv[0].status === 'submitted') return { success: false, error: "Nie można anulować zatwierdzonej inwentaryzacji." };
    
    await db.delete(warehouseInventoryItems).where(eq(warehouseInventoryItems.inventoryId, inventoryId));
    await db.delete(warehouseInventories).where(eq(warehouseInventories.id, inventoryId));
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// DASHBOARD I HISTORIA RUCHÓW
// -------------------------------------------------------------

export async function getWarehouseDashboardAction() {
  await checkAuth('inventory:view');
  try {
    const products = await db.select({
      id: warehouseProducts.id,
      name: warehouseProducts.name,
      minStock: warehouseProducts.minStock,
      maxStock: warehouseProducts.maxStock,
      unit: warehouseProducts.unit,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id}), 0)`
    })
    .from(warehouseProducts)
    .where(eq(warehouseProducts.status, 'active'));
    
    const lowStockProducts = products.filter(p => p.currentStock <= p.minStock);
    
    const batchesWithExpiry = await db.select({
      id: warehouseBatches.id,
      productName: warehouseProducts.name,
      batchNumber: warehouseBatches.batchNumber,
      expiryDate: warehouseBatches.expiryDate,
      quantity: warehouseBatches.quantity
    })
    .from(warehouseBatches)
    .leftJoin(warehouseProducts, eq(warehouseBatches.productId, warehouseProducts.id))
    .where(and(
      sql`expiry_date IS NOT NULL`,
      sql`quantity > 0`
    ));
    
    const today = new Date();
    const expiryAlerts = batchesWithExpiry.map(b => {
      const exp = new Date(b.expiryDate!);
      const diffTime = exp.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let status: 'ok' | 'warning' | 'critical' | 'expired' = 'ok';
      let label = "OK";
      
      if (diffDays < 0) {
        status = 'expired';
        label = "Przeterminowane";
      } else if (diffDays <= 7) {
        status = 'critical';
        label = "Pilne (< 7 dni)";
      } else if (diffDays <= 30) {
        status = 'warning';
        label = "Zbliża się termin (7-30 dni)";
      }
      
      return {
        ...b,
        daysLeft: diffDays,
        status,
        label
      };
    })
    .filter(b => b.status !== 'ok');
    
    const recentDeliveries = await db.select({
      id: warehouseHistory.id,
      date: warehouseHistory.createdAt,
      productName: warehouseProducts.name,
      quantity: warehouseHistory.quantity,
      source: warehouseHistory.source,
      userName: users.displayName
    })
    .from(warehouseHistory)
    .leftJoin(warehouseProducts, eq(warehouseHistory.productId, warehouseProducts.id))
    .leftJoin(users, eq(warehouseHistory.userId, users.id))
    .where(eq(warehouseHistory.type, 'delivery'))
    .orderBy(desc(warehouseHistory.createdAt))
    .limit(5);
    
    const recentIssues = await db.select({
      id: warehouseHistory.id,
      date: warehouseHistory.createdAt,
      productName: warehouseProducts.name,
      quantity: warehouseHistory.quantity,
      source: warehouseHistory.source,
      userName: users.displayName
    })
    .from(warehouseHistory)
    .leftJoin(warehouseProducts, eq(warehouseHistory.productId, warehouseProducts.id))
    .leftJoin(users, eq(warehouseHistory.userId, users.id))
    .where(eq(warehouseHistory.type, 'issue'))
    .orderBy(desc(warehouseHistory.createdAt))
    .limit(5);
    
    const lastInv = await db.select({
      id: warehouseInventories.id,
      date: warehouseInventories.createdAt,
      userName: users.displayName
    })
    .from(warehouseInventories)
    .leftJoin(users, eq(warehouseInventories.userId, users.id))
    .where(eq(warehouseInventories.status, 'submitted'))
    .orderBy(desc(warehouseInventories.createdAt))
    .limit(1);
    
    // Szukamy też ewentualnego aktywnego wybiórczego spot checka na dziś
    const todayStr = new Date().toISOString().split('T')[0];
    const activeSpot = await db.select({
      id: warehouseInventories.id,
      date: warehouseInventories.createdAt
    })
    .from(warehouseInventories)
    .where(and(
      eq(warehouseInventories.type, 'spot'),
      eq(warehouseInventories.status, 'draft'),
      sql`DATE(created_at) = ${todayStr}`
    ))
    .limit(1);

    return {
      success: true,
      data: {
        totalProductsCount: products.length,
        lowStockCount: lowStockProducts.length,
        lowStockList: lowStockProducts,
        expiryAlertsCount: expiryAlerts.length,
        expiryAlertsList: expiryAlerts,
        recentDeliveries,
        recentIssues,
        lastInventory: lastInv.length > 0 ? lastInv[0] : null,
        activeSpotCheckId: activeSpot.length > 0 ? activeSpot[0].id : null
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getWarehouseHistoryAction(filters?: { productId?: number; type?: string }) {
  await checkAuth('inventory:view');
  try {
    const conditions = [];
    if (filters?.productId) {
      conditions.push(eq(warehouseHistory.productId, filters.productId));
    }
    if (filters?.type) {
      conditions.push(eq(warehouseHistory.type, filters.type as any));
    }
    
    const baseQuery = db.select({
      id: warehouseHistory.id,
      date: warehouseHistory.createdAt,
      productName: warehouseProducts.name,
      unit: warehouseProducts.unit,
      batchNumber: warehouseBatches.batchNumber,
      quantity: warehouseHistory.quantity,
      type: warehouseHistory.type,
      source: warehouseHistory.source,
      remarks: warehouseHistory.remarks,
      userName: users.displayName
    })
    .from(warehouseHistory)
    .leftJoin(warehouseProducts, eq(warehouseHistory.productId, warehouseProducts.id))
    .leftJoin(warehouseBatches, eq(warehouseHistory.batchId, warehouseBatches.id))
    .leftJoin(users, eq(warehouseHistory.userId, users.id));
    
    const query = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;
      
    const data = await query.orderBy(desc(warehouseHistory.createdAt));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// SYSTEMOWE TRIGGEROWANIE WYBIÓRCZEJ INWENTARYZACJI (SPOT CHECK)
// -------------------------------------------------------------

export async function triggerDailySpotCheckAction(dateStr: string) {
  try {
    const existing = await db.select()
      .from(warehouseInventories)
      .where(and(
        eq(warehouseInventories.type, 'spot'),
        sql`DATE(created_at) = ${dateStr}`
      ))
      .limit(1);
      
    if (existing.length > 0) {
      return { success: true, alreadyExists: true, inventoryId: existing[0].id };
    }
    
    const spotCheckProducts = await db.select({
      id: warehouseProducts.id,
      name: warehouseProducts.name,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id}), 0)`
    })
    .from(warehouseProducts)
    .where(and(
      eq(warehouseProducts.status, 'active'),
      eq(warehouseProducts.autoSpotCheck, true)
    ));
    
    if (spotCheckProducts.length === 0) {
      return { success: true, reason: "Brak produktów oznaczonych do automatycznej inwentaryzacji." };
    }
    
    const shuffled = [...spotCheckProducts].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    const defaultAdmin = await db.select().from(users).where(eq(users.role, 'owner')).limit(1);
    const systemUserId = defaultAdmin.length > 0 ? defaultAdmin[0].id : 1;
    
    const [insertInv] = await db.insert(warehouseInventories).values({
      userId: systemUserId,
      type: 'spot',
      status: 'draft',
      createdAt: new Date(dateStr + "T08:00:00")
    });
    const inventoryId = (insertInv as any).insertId || 0;
    
    for (const p of selected) {
      await db.insert(warehouseInventoryItems).values({
        inventoryId,
        productId: p.id,
        systemStock: p.currentStock,
        actualStock: null,
        difference: null
      });
    }
    
    const productNames = selected.map(p => p.name).join(', ');
    await db.insert(shiftTasks).values({
      date: dateStr,
      title: `[MAGAZYN] Inwentaryzacja wybiórcza: Sprawdź stan dla: ${productNames}`,
      type: 'recurring',
      priority: 'high',
      isCompleted: false,
      isDemo: false
    });
    
    console.log(`[SpotCheck] Wygenerowano automatyczną inwentaryzację ID: ${inventoryId} na dzień ${dateStr}`);
    return { success: true, inventoryId };
  } catch (e: any) {
    console.error("Błąd generowania inwentaryzacji wybiórczej:", e);
    return { success: false, error: e.message };
  }
}
