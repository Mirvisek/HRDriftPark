import { z } from "zod";

export const dateStrSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty musi być YYYY-MM-DD.");

export const timeStrSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Godzina musi mieć format HH:MM.");

export const positiveIntSchema = z.number().int().positive();

export const cashFormSchema = z.object({
  openingCash: z.number().finite(),
  closingCash: z.number().finite(),
  fiscalReport: z.number().finite(),
  terminalReport: z.number().finite(),
  blikReport: z.number().finite(),
  cashToBag: z.number().finite(),
  eventCash: z.number().finite(),
  cashOperations: z.number().finite(),
  operationsDescription: z.string().max(2000).optional(),
  differenceDescription: z.string().max(2000).optional(),
});

export const shiftReportSchema = z.object({
  intensity: z.enum(["calm", "standard", "busy"]),
  incidents: z.string().max(4000).optional(),
  equipmentNotes: z.string().max(4000).optional(),
  stockNotes: z.string().max(4000).optional(),
  handoverNotes: z.string().max(4000).optional(),
});

export const eventDataSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(255),
  customerName: z.string().trim().min(1).max(255),
  customerPhone: z.string().trim().max(50).optional(),
  date: dateStrSchema,
  startTime: timeStrSchema,
  endTime: timeStrSchema,
  participantsCount: z.number().int().min(1).max(10000),
  totalAmount: z.number().finite().min(0).max(1_000_000),
  depositPaid: z.number().finite().min(0).max(1_000_000),
  notes: z.string().max(4000).optional(),
  status: z.string().max(50).optional(),
});

export const warehouseImportItemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  categoryName: z.string().trim().min(1).max(255),
  unit: z.string().trim().max(50).default("szt."),
  supplier: z.string().trim().max(255).default(""),
  sku: z.string().trim().max(100).default(""),
  location: z.string().trim().max(255).default(""),
  initialStock: z.number().finite().min(0).max(1_000_000).default(0),
  minStock: z.number().finite().min(0).max(1_000_000).default(0),
  maxStock: z.number().finite().min(0).max(1_000_000).default(0),
  hasExpiry: z.boolean().default(false),
  autoSpotCheck: z.boolean().default(false),
  remarks: z.string().trim().max(2000).default(""),
});

export const warehouseImportListSchema = z
  .array(warehouseImportItemSchema)
  .min(1, "Brak produktów do importu.")
  .max(500, "Limit importu to 500 produktów naraz.");

export const pushMessageSchema = z.object({
  userId: z.number().int().min(0),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
});

export const availabilitySaveSchema = z.object({
  userId: positiveIntSchema,
  dateStr: dateStrSchema,
  status: z.enum(["available", "unavailable"]),
  remarks: z.string().max(2000).default(""),
});

export function parseOrError<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      success: false,
      error: first?.message || "Nieprawidłowe dane wejściowe.",
    };
  }
  return { success: true, data: result.data };
}
