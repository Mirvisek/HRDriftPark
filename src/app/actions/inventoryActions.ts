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
  shiftTasks,
  venues,
  settings
} from "@/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import fs from 'fs';
import path from 'path';

// Pomocnik weryfikacji uprawnień na serwerze
async function checkAuth(permission?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Brak autoryzacji.");
  if (permission && !hasPermission(session.user, permission as any)) {
    throw new Error(`Brak wymaganych uprawnień: ${permission}`);
  }
  return session;
}

// Pomocnik zapisu przesłanego pliku na serwerze
async function saveUploadedFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const ext = path.extname(file.name) || '.jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');
  
  await fs.promises.mkdir(uploadDir, { recursive: true });
  
  const filePath = path.join(uploadDir, fileName);
  await fs.promises.writeFile(filePath, buffer);
  
  return `/uploads/receipts/${fileName}`;
}

// -------------------------------------------------------------
// KATEGORIE
// -------------------------------------------------------------

export async function getCategoriesAction() {
  const session = await checkAuth('inventory:view');
  const userIsDemo = (session.user as any).isDemo === true;
  try {
    const data = await db.select().from(warehouseCategories)
      .where(eq(warehouseCategories.isDemo, userIsDemo))
      .orderBy(asc(warehouseCategories.name));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveCategoryAction(id: number | null, name: string) {
  const session = await checkAuth('inventory:manage');
  const userIsDemo = (session.user as any).isDemo === true;
  try {
    if (!name.trim()) return { success: false, error: "Nazwa kategorii nie może być pusta." };
    if (id) {
      await db.update(warehouseCategories).set({ name: name.trim() }).where(and(eq(warehouseCategories.id, id), eq(warehouseCategories.isDemo, userIsDemo)));
    } else {
      await db.insert(warehouseCategories).values({ name: name.trim(), isDemo: userIsDemo });
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
  const session = await checkAuth('inventory:view');
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;
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
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id} AND venue_id = ${userVenueId} AND is_demo = ${userIsDemo ? 1 : 0}), 0)`
    })
    .from(warehouseProducts)
    .leftJoin(warehouseCategories, eq(warehouseProducts.categoryId, warehouseCategories.id))
    .where(eq(warehouseProducts.isDemo, userIsDemo))
    .orderBy(asc(warehouseProducts.name));
    
    return { success: true, data: products };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function addProductAction(productData: any) {
  const session = await checkAuth('inventory:manage');
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;
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
      remarks: productData.remarks?.trim() || null,
      isDemo: userIsDemo
    });
    
    const productId = (insertResult as any).insertId || 0;
    
    // Automatycznie wstawiamy domyślną partię dla produktów bez terminu ważności dla obecnego lokalu
    if (!productData.hasExpiry) {
      await db.insert(warehouseBatches).values({
        productId,
        batchNumber: 'DEFAULT',
        expiryDate: null,
        quantity: 0,
        venueId: userVenueId,
        isDemo: userIsDemo
      });
    }
    
    return { success: true, productId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateProductAction(id: number, productData: any) {
  const session = await checkAuth('inventory:manage');
  const userVenueId = (session.user as any).venueId || 1;
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
    
    // Konwersja partii dla tego lokalu przy zmianie trybu terminu ważności
    if (wasExpiry && !isExpiry) {
      const hasDefault = await db.select().from(warehouseBatches).where(and(eq(warehouseBatches.productId, id), eq(warehouseBatches.batchNumber, 'DEFAULT'), eq(warehouseBatches.venueId, userVenueId))).limit(1);
      if (hasDefault.length === 0) {
        const activeBatches = await db.select().from(warehouseBatches).where(and(eq(warehouseBatches.productId, id), eq(warehouseBatches.venueId, userVenueId)));
        const sumQty = activeBatches.reduce((acc, b) => acc + b.quantity, 0);
        
        await db.insert(warehouseBatches).values({
          productId: id,
          batchNumber: 'DEFAULT',
          expiryDate: null,
          quantity: sumQty,
          venueId: userVenueId
        });
        
        await db.delete(warehouseBatches).where(and(eq(warehouseBatches.productId, id), eq(warehouseBatches.venueId, userVenueId), sql`batch_number != 'DEFAULT'`));
      }
    } else if (!wasExpiry && isExpiry) {
      await db.update(warehouseBatches)
        .set({ batchNumber: 'PARTIA-A' })
        .where(and(eq(warehouseBatches.productId, id), eq(warehouseBatches.batchNumber, 'DEFAULT'), eq(warehouseBatches.venueId, userVenueId)));
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteProductAction(id: number) {
  await checkAuth('inventory:manage');
  try {
    await db.update(warehouseProducts)
      .set({ status: 'inactive' })
      .where(eq(warehouseProducts.id, id));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// OPERACJE: ZBIORCZE DOSTAWY ZE ZDJĘCIEM I WYDANIA
// -------------------------------------------------------------

export async function deliverBulkProductsAction(formData: FormData) {
  const session = await checkAuth('inventory:deliver');
  const userId = Number((session.user as any).id);
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;
  
  try {
    const supplier = formData.get('supplier') as string || 'Dostawca Zewnętrzny';
    const documentNumber = formData.get('documentNumber') as string || '';
    const remarks = formData.get('remarks') as string || '';
    const itemsJson = formData.get('items') as string;
    const file = formData.get('file') as File;
    
    if (!itemsJson) return { success: false, error: "Brak pozycji dostawy." };
    const items = JSON.parse(itemsJson) as Array<{ productId: number; quantity: number; batchNumber?: string; expiryDate?: string; }>;
    if (items.length === 0) return { success: false, error: "Dostawa musi zawierać co najmniej jedną pozycję." };
    
    if (!file || file.size === 0) {
      // Miękka obsługa — zezwól na dostawę bez zdjęcia, attachment_url pozostanie null
      console.warn('[Delivery] Zarejestrowano dostawę bez zdjęcia faktury/paragonu.');
    }
    
    // Zapisz plik na dysku tylko jeśli jest realny (rozmiar > 0)
    const attachmentUrl = (file && file.size > 0) ? await saveUploadedFile(file) : null;
    
    for (const item of items) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) continue;
      
      const product = await db.select().from(warehouseProducts).where(eq(warehouseProducts.id, item.productId)).limit(1);
      if (product.length === 0) continue;
      
      let batchId: number | null = null;
      
      if (product[0].hasExpiry) {
        const bNum = item.batchNumber?.trim() || 'PARTIA-' + new Date().toISOString().split('T')[0];
        const expDate = item.expiryDate || null;
        
        const existingBatch = await db.select()
          .from(warehouseBatches)
          .where(and(
            eq(warehouseBatches.productId, item.productId),
            eq(warehouseBatches.batchNumber, bNum),
            eq(warehouseBatches.venueId, userVenueId)
          ))
          .limit(1);
          
        if (existingBatch.length > 0) {
          batchId = existingBatch[0].id;
          await db.update(warehouseBatches)
            .set({ quantity: existingBatch[0].quantity + qty })
            .where(eq(warehouseBatches.id, batchId));
        } else {
          const [insertBatch] = await db.insert(warehouseBatches).values({
            productId: item.productId,
            batchNumber: bNum,
            expiryDate: expDate,
            quantity: qty,
            venueId: userVenueId,
            isDemo: userIsDemo
          });
          batchId = (insertBatch as any).insertId || null;
        }
      } else {
        const existingBatch = await db.select()
          .from(warehouseBatches)
          .where(and(
            eq(warehouseBatches.productId, item.productId),
            eq(warehouseBatches.batchNumber, 'DEFAULT'),
            eq(warehouseBatches.venueId, userVenueId)
          ))
          .limit(1);
          
        if (existingBatch.length > 0) {
          batchId = existingBatch[0].id;
          await db.update(warehouseBatches)
            .set({ quantity: existingBatch[0].quantity + qty })
            .where(eq(warehouseBatches.id, batchId));
        } else {
          const [insertBatch] = await db.insert(warehouseBatches).values({
            productId: item.productId,
            batchNumber: 'DEFAULT',
            expiryDate: null,
            quantity: qty,
            venueId: userVenueId,
            isDemo: userIsDemo
          });
          batchId = (insertBatch as any).insertId || null;
        }
      }
      
      // Log history entry per item
      await db.insert(warehouseHistory).values({
        productId: item.productId,
        batchId,
        userId,
        type: 'delivery',
        quantity: qty,
        source: supplier.trim(),
        remarks: remarks.trim() || (documentNumber ? `Faktura/Dokument: ${documentNumber}` : null),
        attachmentUrl,
        venueId: userVenueId,
        isDemo: userIsDemo
      });
    }
    
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas zapisywania dostawy zbiorczej:", e);
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
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;
  
  try {
    const qty = Number(data.quantity);
    if (isNaN(qty) || qty <= 0) return { success: false, error: "Ilość musi być większa od zera." };
    if (!data.venue?.trim()) return { success: false, error: "Nazwa lokalu docelowego jest wymagana." };
    
    const product = await db.select().from(warehouseProducts).where(eq(warehouseProducts.id, data.productId)).limit(1);
    if (product.length === 0) return { success: false, error: "Produkt nie istnieje." };
    
    const batches = await db.select()
      .from(warehouseBatches)
      .where(and(
        eq(warehouseBatches.productId, data.productId),
        eq(warehouseBatches.venueId, userVenueId),
        eq(warehouseBatches.isDemo, userIsDemo)
      ))
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
        remarks: data.remarks?.trim() || null,
        venueId: userVenueId,
        isDemo: userIsDemo
      });
      
      remainingToIssue -= issueFromThisBatch;
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// INWENTARYZACJE (SESJE) DLA LOKALU
// -------------------------------------------------------------

export async function startInventoryAction(categoryId: number | null) {
  const session = await checkAuth('inventory:inventory');
  const userId = Number((session.user as any).id);
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;
  
  try {
    const activeDraft = await db.select()
      .from(warehouseInventories)
      .where(and(
        eq(warehouseInventories.status, 'draft'),
        eq(warehouseInventories.venueId, userVenueId)
      ))
      .limit(1);
       
    if (activeDraft.length > 0) {
      return { success: false, error: "Istnieje już otwarta inwentaryzacja robocza. Dokończ ją lub anuluj przed rozpoczęciem nowej.", inventoryId: activeDraft[0].id };
    }
    
    const [insertInv] = await db.insert(warehouseInventories).values({
      userId,
      categoryId,
      type: 'full',
      status: 'draft',
      venueId: userVenueId,
      isDemo: userIsDemo
    });
    
    const inventoryId = (insertInv as any).insertId || 0;
    
    const conditions = [eq(warehouseProducts.status, 'active')];
    if (categoryId) {
      conditions.push(eq(warehouseProducts.categoryId, categoryId));
    }
    
    const products = await db.select({
      id: warehouseProducts.id,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id} AND venue_id = ${userVenueId} AND is_demo = ${userIsDemo ? 1 : 0}), 0)`
    })
    .from(warehouseProducts)
    .where(and(...conditions, eq(warehouseProducts.isDemo, userIsDemo)));
    
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
  const userVenueId = (session.user as any).venueId || 1;
  
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
        .where(and(
          eq(warehouseBatches.productId, productId),
          eq(warehouseBatches.venueId, userVenueId)
        ))
        .orderBy(desc(warehouseBatches.id));
        
      if (activeBatches.length === 0) {
        // Jeśli nie było partii w lokalu, zainicjalizuj ją korektą
        const isExpiry = (await db.select({ hasExpiry: warehouseProducts.hasExpiry }).from(warehouseProducts).where(eq(warehouseProducts.id, productId)).limit(1))[0]?.hasExpiry;
        const [insertBatch] = await db.insert(warehouseBatches).values({
          productId,
          batchNumber: isExpiry ? 'PARTIA-KOREKTA' : 'DEFAULT',
          expiryDate: null,
          quantity: diff,
          venueId: userVenueId
        });
        
        await db.insert(warehouseHistory).values({
          productId,
          batchId: (insertBatch as any).insertId || null,
          userId,
          type: 'correction',
          quantity: diff,
          source: `Inwentaryzacja ID: ${inventoryId}`,
          remarks: item.remarks || 'Inicjalizacja stanu w inwentaryzacji',
          venueId: userVenueId
        });
        continue;
      }
      
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
          remarks: item.remarks || 'Korekta inwentaryzacyjna (nadwyżka)',
          venueId: userVenueId
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
            remarks: item.remarks || 'Korekta inwentaryzacyjna (niedobór)',
            venueId: userVenueId
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
            remarks: item.remarks || 'Korekta inwentaryzacyjna (niedobór poniżej zera)',
            venueId: userVenueId
          });
        }
      }
    }
    
    await db.update(warehouseInventories)
      .set({ status: 'submitted' })
      .where(eq(warehouseInventories.id, inventoryId));
      
    const todayStr = new Date().toISOString().split('T')[0];
    const execUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const userName = execUser.length > 0 ? execUser[0].displayName : 'Pracownik';

    if (inv[0].type === 'spot') {
      await db.update(shiftTasks)
        .set({ 
          isCompleted: true,
          completedBy: userId,
          completedByName: userName,
          completedAt: new Date()
        })
        .where(and(
          eq(shiftTasks.date, todayStr),
          eq(shiftTasks.venueId, userVenueId),
          sql`title LIKE '%Inwentaryzacja wybiórcza%'`
        ));
    } else if (inv[0].type === 'full') {
      await db.update(shiftTasks)
        .set({ 
          isCompleted: true,
          completedBy: userId,
          completedByName: userName,
          completedAt: new Date()
        })
        .where(and(
          eq(shiftTasks.date, todayStr),
          eq(shiftTasks.venueId, userVenueId),
          sql`title LIKE '%Cotygodniowa pełna inwentaryzacja%'`
        ));
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getInventoryHistoryAction() {
  const session = await checkAuth('inventory:view');
  const userVenueId = (session.user as any).venueId || 1;
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
    .where(eq(warehouseInventories.venueId, userVenueId))
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
// DASHBOARD I HISTORIA RUCHÓW DLA LOKALU
// -------------------------------------------------------------

export async function getWarehouseDashboardAction() {
  const session = await checkAuth('inventory:view');
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;
  try {
    const products = await db.select({
      id: warehouseProducts.id,
      name: warehouseProducts.name,
      minStock: warehouseProducts.minStock,
      maxStock: warehouseProducts.maxStock,
      unit: warehouseProducts.unit,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id} AND venue_id = ${userVenueId} AND is_demo = ${userIsDemo ? 1 : 0}), 0)`
    })
    .from(warehouseProducts)
    .where(and(eq(warehouseProducts.status, 'active'), eq(warehouseProducts.isDemo, userIsDemo)));
    
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
      sql`quantity > 0`,
      eq(warehouseBatches.venueId, userVenueId),
      eq(warehouseBatches.isDemo, userIsDemo)
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
    .where(and(
      eq(warehouseHistory.type, 'delivery'),
      eq(warehouseHistory.venueId, userVenueId),
      eq(warehouseHistory.isDemo, userIsDemo)
    ))
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
    .where(and(
      eq(warehouseHistory.type, 'issue'),
      eq(warehouseHistory.venueId, userVenueId),
      eq(warehouseHistory.isDemo, userIsDemo)
    ))
    .orderBy(desc(warehouseHistory.createdAt))
    .limit(5);
    
    const lastInv = await db.select({
      id: warehouseInventories.id,
      date: warehouseInventories.createdAt,
      userName: users.displayName
    })
    .from(warehouseInventories)
    .leftJoin(users, eq(warehouseInventories.userId, users.id))
    .where(and(
      eq(warehouseInventories.status, 'submitted'),
      eq(warehouseInventories.venueId, userVenueId),
      eq(warehouseInventories.isDemo, userIsDemo)
    ))
    .orderBy(desc(warehouseInventories.createdAt))
    .limit(1);
    
    const todayStr = new Date().toISOString().split('T')[0];
    const activeSpot = await db.select({
      id: warehouseInventories.id,
      date: warehouseInventories.createdAt
    })
    .from(warehouseInventories)
    .where(and(
      eq(warehouseInventories.type, 'spot'),
      eq(warehouseInventories.status, 'draft'),
      eq(warehouseInventories.venueId, userVenueId),
      sql`DATE(created_at) = ${todayStr}`,
      eq(warehouseInventories.isDemo, userIsDemo)
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
  const session = await checkAuth('inventory:view');
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;
  try {
    const conditions = [
      eq(warehouseHistory.venueId, userVenueId),
      eq(warehouseHistory.isDemo, userIsDemo)
    ];
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
      userName: users.displayName,
      attachmentUrl: warehouseHistory.attachmentUrl
    })
    .from(warehouseHistory)
    .leftJoin(warehouseProducts, eq(warehouseHistory.productId, warehouseProducts.id))
    .leftJoin(warehouseBatches, eq(warehouseHistory.batchId, warehouseBatches.id))
    .leftJoin(users, eq(warehouseHistory.userId, users.id));
    
    const query = baseQuery.where(and(...conditions));
    const data = await query.orderBy(desc(warehouseHistory.createdAt));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// SYSTEMOWE TRIGGEROWANIE WYBIÓRCZEJ INWENTARYZACJI (SPOT CHECK) PER LOKAL
// -------------------------------------------------------------

export async function triggerDailySpotCheckAction(dateStr: string, venueId: number, isDemo: boolean = false) {
  try {
    const existing = await db.select()
      .from(warehouseInventories)
      .where(and(
        eq(warehouseInventories.type, 'spot'),
        eq(warehouseInventories.venueId, venueId),
        eq(warehouseInventories.isDemo, isDemo),
        sql`DATE(created_at) = ${dateStr}`
      ))
      .limit(1);
      
    if (existing.length > 0) {
      return { success: true, alreadyExists: true, inventoryId: existing[0].id };
    }
    
    const spotCheckProducts = await db.select({
      id: warehouseProducts.id,
      name: warehouseProducts.name,
      currentStock: sql<number>`COALESCE((SELECT SUM(quantity) FROM warehouse_batches WHERE product_id = ${warehouseProducts.id} AND venue_id = ${venueId} AND is_demo = ${isDemo ? 1 : 0}), 0)`
    })
    .from(warehouseProducts)
    .where(and(
      eq(warehouseProducts.status, 'active'),
      eq(warehouseProducts.autoSpotCheck, true),
      eq(warehouseProducts.isDemo, isDemo)
    ));
    
    if (spotCheckProducts.length === 0) {
      return { success: true, reason: "Brak produktów oznaczonych do automatycznej inwentaryzacji." };
    }
    
    const shuffled = [...spotCheckProducts].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    const defaultAdmin = await db.select().from(users).where(and(
      eq(users.role, 'owner'),
      eq(users.venueId, venueId),
      eq(users.isDemo, isDemo)
    )).limit(1);
    const systemUserId = defaultAdmin.length > 0 ? defaultAdmin[0].id : 1;
    
    const [insertInv] = await db.insert(warehouseInventories).values({
      userId: systemUserId,
      type: 'spot',
      status: 'draft',
      createdAt: new Date(dateStr + "T08:00:00"),
      venueId,
      isDemo
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
      isDemo,
      venueId
    });
    
    console.log(`[SpotCheck] Wygenerowano automatyczną inwentaryzację ID: ${inventoryId} dla lokalu ID: ${venueId} na dzień ${dateStr}`);
    return { success: true, inventoryId };
  } catch (e: any) {
    console.error("Błąd generowania inwentaryzacji wybiórczej:", e);
    return { success: false, error: e.message };
  }
}

export async function getWarehousePresetsAction() {
  await checkAuth('inventory:view');
  try {
    const results = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    results.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    const locationsStr = settingsMap['warehouse_locations'] || '';
    const suppliersStr = settingsMap['warehouse_suppliers'] || '';

    const locations = locationsStr
      ? locationsStr.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : ['Magazyn Główny', 'Półka A', 'Półka B', 'Lodówka 1', 'Zaplecze'];

    const suppliers = suppliersStr
      ? suppliersStr.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : ['Makro', 'Allegro', 'Dostawca Zewnętrzny', 'Hurtownia'];

    return { success: true, locations, suppliers };
  } catch (e: any) {
    console.error("Błąd pobierania słowników magazynu:", e);
    return { success: false, error: e.message };
  }
}

export async function importBulkProductsAction(productsList: Array<{
  name: string;
  categoryName: string;
  unit: string;
  supplier: string;
  sku: string;
  location: string;
  initialStock: number;
  minStock: number;
  maxStock: number;
  hasExpiry: boolean;
  autoSpotCheck: boolean;
  remarks: string;
}>) {
  const session = await checkAuth('inventory:manage');
  const userId = Number((session.user as any).id);
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;

  try {
    let successCount = 0;
    
    // Pobierz istniejące kategorie (tego samego trybu), by nie odpytywać bazy w pętli bez potrzeby
    const allCategories = await db.select().from(warehouseCategories).where(eq(warehouseCategories.isDemo, userIsDemo));
    const categoryMap = new Map<string, number>();
    allCategories.forEach(c => categoryMap.set(c.name.toLowerCase().trim(), c.id));

    for (const item of productsList) {
      if (!item.name || !item.name.trim()) continue;
      const catNameNorm = (item.categoryName || 'Inne').trim();
      const catKey = catNameNorm.toLowerCase();
      
      let categoryId: number;
      if (categoryMap.has(catKey)) {
        categoryId = categoryMap.get(catKey)!;
      } else {
        // Dodaj nową kategorię
        const [insertCat] = await db.insert(warehouseCategories).values({
          name: catNameNorm,
          isDemo: userIsDemo
        });
        categoryId = (insertCat as any).insertId || 0;
        categoryMap.set(catKey, categoryId);
      }

      // Wstaw produkt
      const [insertProd] = await db.insert(warehouseProducts).values({
        name: item.name.trim(),
        categoryId,
        unit: item.unit?.trim() || 'szt.',
        supplier: item.supplier?.trim() || null,
        minStock: Number(item.minStock) || 0,
        maxStock: Number(item.maxStock) || 0,
        sku: item.sku?.trim() || null,
        location: item.location?.trim() || null,
        hasExpiry: !!item.hasExpiry,
        autoSpotCheck: !!item.autoSpotCheck,
        remarks: item.remarks?.trim() || null,
        status: 'active',
        isDemo: userIsDemo
      });
      const productId = (insertProd as any).insertId || 0;

      // Jeśli podano stan początkowy, zasilamy go partią i historią
      const initialQty = Number(item.initialStock);
      if (!isNaN(initialQty) && initialQty > 0 && productId > 0) {
        const [insertBatch] = await db.insert(warehouseBatches).values({
          productId,
          batchNumber: item.hasExpiry ? 'PARTIA-START' : 'DEFAULT',
          expiryDate: null,
          quantity: initialQty,
          venueId: userVenueId,
          isDemo: userIsDemo
        });
        
        await db.insert(warehouseHistory).values({
          productId,
          batchId: (insertBatch as any).insertId || null,
          userId,
          type: 'correction',
          quantity: initialQty,
          source: 'Import z Excela',
          remarks: 'Inicjalizacja stanu z importu Excela',
          venueId: userVenueId,
          isDemo: userIsDemo
        });
      }
      
      successCount++;
    }

    return { success: true, count: successCount };
  } catch (e: any) {
    console.error("Błąd podczas importu z Excela:", e);
    return { success: false, error: e.message };
  }
}

export async function clearWarehouseHistoryAction() {
  const session = await checkAuth('inventory:manage');
  const userVenueId = (session.user as any).venueId || 1;
  const userIsDemo = (session.user as any).isDemo === true;

  try {
    await db.delete(warehouseHistory).where(and(
      eq(warehouseHistory.venueId, userVenueId),
      eq(warehouseHistory.isDemo, userIsDemo)
    ));
    return { success: true };
  } catch (e: any) {
    console.error("Błąd podczas czyszczenia historii operacji:", e);
    return { success: false, error: e.message };
  }
}
