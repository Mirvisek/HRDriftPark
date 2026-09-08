'use server';

import { getDemoData, saveDemoData, resetDemoData, DemoTask, DemoChecklistItem, DemoInventoryProduct } from '@/db/demoDbStore';

export async function getDemoDataAction() {
  try {
    const data = getDemoData();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Błąd odczytu danych demo.' };
  }
}

export async function toggleDemoChecklistAction(itemId: number) {
  try {
    const data = getDemoData();
    const item = data.checklists.find(c => c.id === itemId);
    if (!item) return { success: false, error: 'Nie znaleziono zadania checklisty.' };

    item.status = item.status === 'completed' ? 'pending' : 'completed';
    item.completedByName = item.status === 'completed' ? 'Użytkownik Demo' : undefined;

    saveDemoData(data);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleDemoTaskAction(taskId: number) {
  try {
    const data = getDemoData();
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Nie znaleziono zadania.' };

    task.completed = !task.completed;
    saveDemoData(data);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addDemoTaskAction(title: string, description?: string) {
  try {
    if (!title.trim()) return { success: false, error: 'Tytuł zadania nie może być pusty.' };

    const data = getDemoData();
    const newTask: DemoTask = {
      id: Date.now(),
      title: title.trim(),
      description: description?.trim(),
      assignedToName: 'Użytkownik Demo',
      completed: false,
      dueDate: new Date().toISOString().split('T')[0],
    };

    data.tasks.push(newTask);
    saveDemoData(data);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateDemoInventoryStockAction(productId: number, delta: number) {
  try {
    const data = getDemoData();
    const prod = data.inventory.find(i => i.id === productId);
    if (!prod) return { success: false, error: 'Nie znaleziono produktu.' };

    prod.currentStock = Math.max(0, prod.currentStock + delta);
    saveDemoData(data);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resetDemoStoreAction() {
  try {
    const freshData = resetDemoData();
    return { success: true, data: freshData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
