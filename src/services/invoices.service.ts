import type { Pool } from 'pg';
import {
  INVOICE_COLUMNS,
  MUTABLE_COLUMNS,
  RESERVED_QUERY_KEYS,
} from '../schemas/invoices.schemas';

const TABLE_NAME = 'invoices';
const INVOICE_ALIAS = 'i';
const SELLER_NAME_FIELD = 'seller_name';

const isInvoiceColumn = (value: string) =>
  INVOICE_COLUMNS.includes(value as (typeof INVOICE_COLUMNS)[number]);

const isMutableColumn = (value: string) =>
  MUTABLE_COLUMNS.includes(value as (typeof MUTABLE_COLUMNS)[number]);

export const parseInvoiceFields = (fieldsValue: string | undefined) => {
  const normalizeField = (field: string) => {
    if (field === SELLER_NAME_FIELD) {
      return 'seller_contact.contact_name AS seller_name';
    }
    return `${INVOICE_ALIAS}.${field} AS ${field}`;
  };

  if (!fieldsValue?.trim()) {
    const allInvoiceFields = INVOICE_COLUMNS.map((column) => normalizeField(column)).join(', ');
    return `${allInvoiceFields}, ${normalizeField(SELLER_NAME_FIELD)}`;
  }

  const parsed = fieldsValue
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  const invalid = parsed.filter((field) => !isInvoiceColumn(field) && field !== SELLER_NAME_FIELD);
  if (invalid.length) throw new Error(`Invalid fields: ${invalid.join(', ')}`);

  if (!parsed.length) {
    const allInvoiceFields = INVOICE_COLUMNS.map((column) => normalizeField(column)).join(', ');
    return `${allInvoiceFields}, ${normalizeField(SELLER_NAME_FIELD)}`;
  }

  return parsed.map((field) => normalizeField(field)).join(', ');
};

export const buildInvoiceDynamicFilters = (queryParams: Record<string, string>) => {
  const whereClauses: string[] = [];
  const values: unknown[] = [];

  Object.entries(queryParams).forEach(([key, value]) => {
    if (!value || RESERVED_QUERY_KEYS.has(key)) return;

    if (key.endsWith('_from')) {
      const column = key.slice(0, -5);
      if (isInvoiceColumn(column)) {
        values.push(value);
        whereClauses.push(`${INVOICE_ALIAS}.${column} >= $${values.length}`);
      }
      return;
    }

    if (key.endsWith('_to')) {
      const column = key.slice(0, -3);
      if (isInvoiceColumn(column)) {
        values.push(value);
        whereClauses.push(`${INVOICE_ALIAS}.${column} <= $${values.length}`);
      }
      return;
    }

    if (isInvoiceColumn(key)) {
      values.push(value);
      whereClauses.push(`${INVOICE_ALIAS}.${key} = $${values.length}`);
    }
  });

  return { whereClauses, values };
};

export const listInvoices = async (
  db: Pool,
  input: {
    selectedFields: string;
    whereClauses: string[];
    whereValues: unknown[];
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  },
) => {
  const { selectedFields, whereClauses, whereValues, page, limit, sortBy, sortOrder } = input;
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const dataValues = [...whereValues, limit, offset];
  const sortColumn =
    sortBy === SELLER_NAME_FIELD ? 'seller_contact.contact_name' : `${INVOICE_ALIAS}.${sortBy}`;

  const dataQuery = `
    SELECT ${selectedFields}
    FROM ${TABLE_NAME} ${INVOICE_ALIAS}
    LEFT JOIN sellers seller ON ${INVOICE_ALIAS}.id_seller = seller.id_seller
    LEFT JOIN contacts seller_contact ON seller.id_contact = seller_contact.id_contact
    ${whereSql}
    ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
    LIMIT $${whereValues.length + 1}
    OFFSET $${whereValues.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM ${TABLE_NAME} ${INVOICE_ALIAS}
    LEFT JOIN sellers seller ON ${INVOICE_ALIAS}.id_seller = seller.id_seller
    LEFT JOIN contacts seller_contact ON seller.id_contact = seller_contact.id_contact
    ${whereSql}
  `;

  const [dataResult, countResult] = await Promise.all([
    db.query(dataQuery, dataValues),
    db.query(countQuery, whereValues),
  ]);

  return {
    data: dataResult.rows,
    total: countResult.rows[0]?.total ?? 0,
  };
};

export const getInvoiceById = async (
  db: Pool,
  id: number,
  selectedFields: string,
  includeDeleted: boolean,
) => {
  const whereDeleted = includeDeleted ? '' : `AND ${INVOICE_ALIAS}.deleted_at IS NULL`;
  const sql = `
    SELECT ${selectedFields}
    FROM ${TABLE_NAME} ${INVOICE_ALIAS}
    LEFT JOIN sellers seller ON ${INVOICE_ALIAS}.id_seller = seller.id_seller
    LEFT JOIN contacts seller_contact ON seller.id_contact = seller_contact.id_contact
    WHERE ${INVOICE_ALIAS}.id_invoice = $1
    ${whereDeleted}
    LIMIT 1
  `;

  const result = await db.query(sql, [id]);
  return result.rows[0] ?? null;
};

const validatePayloadColumns = (payload: Record<string, unknown>, mode: 'insert' | 'update') => {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  if (!entries.length) throw new Error('At least one field is required');

  const invalid = entries.filter(([key]) => !isMutableColumn(key));
  if (invalid.length) {
    throw new Error(`Invalid columns for ${mode}: ${invalid.map(([key]) => key).join(', ')}`);
  }

  return entries;
};

export const createInvoice = async (db: Pool, payload: Record<string, unknown>) => {
  const entries = validatePayloadColumns(payload, 'insert');
  const columns = entries.map(([key]) => key);
  const values = entries.map(([, value]) => value);
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  const sql = `
    INSERT INTO ${TABLE_NAME} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const result = await db.query(sql, values);
  return result.rows[0];
};

export const updateInvoice = async (db: Pool, id: number, payload: Record<string, unknown>) => {
  const entries = validatePayloadColumns(payload, 'update');
  const updateSet = entries.map(([column], index) => `${column} = $${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);

  const sql = `
    UPDATE ${TABLE_NAME}
    SET ${updateSet}, updated_at = NOW()
    WHERE id_invoice = $${values.length + 1} AND deleted_at IS NULL
    RETURNING *
  `;

  const result = await db.query(sql, [...values, id]);
  return result.rows[0] ?? null;
};

export const softDeleteInvoice = async (
  db: Pool,
  id: number,
  deletedByUserId: string | null,
) => {
  const sql = `
    UPDATE ${TABLE_NAME}
    SET deleted_at = NOW(),
        deleted_by_user_id = COALESCE($1, deleted_by_user_id),
        updated_at = NOW()
    WHERE id_invoice = $2 AND deleted_at IS NULL
    RETURNING *
  `;

  const result = await db.query(sql, [deletedByUserId, id]);
  return result.rows[0] ?? null;
};
