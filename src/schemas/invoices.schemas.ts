import { z } from '@hono/zod-openapi';

export const INVOICE_COLUMNS = [
  'id_invoice',
  'consecutive',
  'date',
  'due_date',
  'observation',
  'tax_amount',
  'total_amount',
  'payment_amount',
  'credit_note_amount',
  'debit_note_amount',
  'balance_amount',
  'qr',
  'status',
  'created_at',
  'updated_at',
  'deleted_at',
  'id_contact',
  'created_by_user_id',
  'updated_by_user_id',
  'deleted_by_user_id',
  'id_seller',
] as const;

export const MUTABLE_COLUMNS = INVOICE_COLUMNS.filter((column) => {
  return !['id_invoice', 'created_at', 'updated_at', 'deleted_at'].includes(column);
});

export const RESERVED_QUERY_KEYS = new Set([
  'ref',
  'fields',
  'page',
  'limit',
  'sort_by',
  'sort_order',
  'include_deleted',
]);

export const SelectInvoiceQuerySchema = z.object({
  ref: z.string().min(1).openapi({
    example: 'mfyskybetbwchtvfsbyi',
    description: 'Referencia de la base de datos de Supabase.',
  }),
  id_contact: z.coerce.number().int().positive().optional().openapi({
    example: 1891,
    description: 'Filtra facturas por contacto.',
  }),
  fields: z.string().optional().openapi({
    example: 'id_invoice,consecutive,total_amount,balance_amount,status,seller_name,created_at',
    description: 'Campos a retornar separados por coma.',
  }),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sort_by: z.enum(INVOICE_COLUMNS).default('id_invoice'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  include_deleted: z.coerce.boolean().default(false),
});

export const GetInvoiceQuerySchema = z.object({
  ref: z.string().min(1),
  fields: z.string().optional(),
  include_deleted: z.coerce.boolean().default(false),
});

export const DbRefQuerySchema = z.object({
  ref: z.string().min(1),
});

export const CreateInvoiceBodySchema = z.object({
  consecutive: z.string().min(1).max(80).optional(),
  date: z.string().optional(),
  due_date: z.string().optional(),
  observation: z.string().optional(),
  tax_amount: z.coerce.number().optional(),
  total_amount: z.coerce.number().optional(),
  payment_amount: z.coerce.number().optional(),
  credit_note_amount: z.coerce.number().optional(),
  debit_note_amount: z.coerce.number().optional(),
  balance_amount: z.coerce.number().optional(),
  qr: z.string().optional(),
  status: z.string().optional(),
  id_contact: z.coerce.number().int().positive().optional(),
  created_by_user_id: z.string().optional(),
  updated_by_user_id: z.string().optional(),
  deleted_by_user_id: z.string().optional(),
  id_seller: z.coerce.number().int().positive().optional(),
});

export const UpdateInvoiceBodySchema = CreateInvoiceBodySchema.partial();

export const DeleteInvoiceBodySchema = z.object({
  deleted_by_user_id: z.string().optional(),
});
