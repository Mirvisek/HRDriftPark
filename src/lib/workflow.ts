export interface WorkflowActor {
  id: number;
  role: 'owner' | 'manager' | 'employee' | 'technik';
}

export interface WorkflowContext {
  hasCriticalAlerts?: boolean;
  isPeriodClosed?: boolean;
  hasDiscrepancy?: boolean;
  reasonCode?: string;
  reasonText?: string;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralny ewaluator maszyny stanów (Module-Specific State Machine Guard)
 */
export function canTransition(
  entity: 'timesheet' | 'cash_reconciliation' | 'work_schedule' | 'inventory' | 'stock_transfer',
  currentStatus: string,
  targetStatus: string,
  actor: WorkflowActor,
  context?: WorkflowContext
): TransitionResult {
  // Jeśli status docelowy jest taki sam, domyślnie zezwalaj
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  // Reguły dla Kart Czasu Pracy (RCP)
  if (entity === 'timesheet') {
    if (currentStatus === 'locked') {
      return {
        allowed: false,
        reason: 'Rekord RCP w stanie LOCKED jest trwale zablokowany. Aby dokonać zmiany, utwórz nowy rekord korekty z wyznaczoną datą obowiązywania (effectiveAt) oraz kodem powodu (reasonCode).'
      };
    }
    if (currentStatus === 'draft' && targetStatus === 'submitted') {
      return { allowed: true };
    }
    if (currentStatus === 'submitted' && targetStatus === 'approved') {
      if (actor.role !== 'owner' && actor.role !== 'manager') {
        return { allowed: false, reason: 'Tylko Manager lub Właściciel może zatwierdzić wpis RCP.' };
      }
      return { allowed: true };
    }
    if (currentStatus === 'submitted' && targetStatus === 'draft') {
      if (actor.role !== 'owner' && actor.role !== 'manager') {
        return { allowed: false, reason: 'Tylko Manager lub Właściciel może cofnąć zgłoszenie do poprawki.' };
      }
      return { allowed: true };
    }
    if (currentStatus === 'approved' && targetStatus === 'locked') {
      if (actor.role !== 'owner' && actor.role !== 'manager') {
        return { allowed: false, reason: 'Tylko Manager lub Właściciel może zamknąć (LOCKED) wpis RCP.' };
      }
      if (context?.hasCriticalAlerts) {
        return { allowed: false, reason: 'Nie można zamknąć RCP (LOCKED) z powodu aktywnych, nierozwiązanych krytycznych alertów/anomalii.' };
      }
      return { allowed: true };
    }
  }

  // Reguły dla Rozliczeń Kasy
  if (entity === 'cash_reconciliation') {
    if (currentStatus === 'locked') {
      return {
        allowed: false,
        reason: 'Rozliczenie kasy w stanie LOCKED jest zamrożone i niemutowalne. Wszelkie zmodyfikowane kwoty należy zgłaszać poprzez korektę operacyjną z podaniem uzasadnienia.'
      };
    }
    if (currentStatus === 'draft' && targetStatus === 'submitted') {
      return { allowed: true };
    }
    if (currentStatus === 'submitted' && targetStatus === 'approved') {
      if (actor.role !== 'owner' && actor.role !== 'manager') {
        return { allowed: false, reason: 'Zatwierdzenie raportu kasowego wymaga uprawnień Managera lub Właściciela.' };
      }
      return { allowed: true };
    }
    if (currentStatus === 'approved' && targetStatus === 'locked') {
      if (actor.role !== 'owner' && actor.role !== 'manager') {
        return { allowed: false, reason: 'Zamknięcie kasy (LOCKED) wymaga roli Managera lub Właściciela.' };
      }
      return { allowed: true };
    }
  }

  // Reguły dla Grafiku Pracy
  if (entity === 'work_schedule') {
    if (currentStatus === 'locked') {
      return { allowed: false, reason: 'Grafik w stanie LOCKED nie może być modyfikowany.' };
    }
    if (currentStatus === 'draft' && targetStatus === 'published') {
      if (actor.role !== 'owner' && actor.role !== 'manager') {
        return { allowed: false, reason: 'Publikacja grafiku wymaga roli Managera lub Właściciela.' };
      }
      if (context?.hasCriticalAlerts && (!context.reasonCode || !context.reasonText)) {
        return { allowed: false, reason: 'Wykryto krytyczne naruszenia odpoczynku/anomalie. Publikacja wymaga uzasadnienia managera (reasonCode + reasonText).' };
      }
      return { allowed: true };
    }
    if (currentStatus === 'published' && targetStatus === 'locked') {
      return { allowed: true };
    }
  }

  // Reguły dla Magazynu (PZ / WZ / Inwentaryzacja)
  if (entity === 'inventory') {
    if (currentStatus === 'locked') {
      return { allowed: false, reason: 'Dokument magazynowy w stanie LOCKED jest niemutowalny.' };
    }
    if (currentStatus === 'draft' && targetStatus === 'posted') {
      return { allowed: true };
    }
    if (currentStatus === 'posted' && targetStatus === 'locked') {
      if (actor.role !== 'owner' && actor.role !== 'manager') {
        return { allowed: false, reason: 'Zamknięcie dokumentu magazynowego (LOCKED) wymaga roli Managera lub Właściciela.' };
      }
      return { allowed: true };
    }
  }

  // Reguły dla Transferów Międzymagazynowych
  if (entity === 'stock_transfer') {
    if (currentStatus === 'created' && targetStatus === 'dispatched') {
      return { allowed: true };
    }
    if (currentStatus === 'created' && targetStatus === 'cancelled') {
      return { allowed: true };
    }
    if (currentStatus === 'dispatched' && (targetStatus === 'received' || targetStatus === 'partially_received')) {
      return { allowed: true };
    }
    if ((currentStatus === 'received' || currentStatus === 'partially_received' || currentStatus === 'cancelled') && targetStatus !== currentStatus) {
      return { allowed: false, reason: 'Zakończony transfer międzymagazynowy nie może zmieniać stanu.' };
    }
  }

  return { allowed: false, reason: `Nieprawidłowe przejście stanu dla ${entity}: ${currentStatus} -> ${targetStatus}` };
}
