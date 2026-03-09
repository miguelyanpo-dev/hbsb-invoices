import type { Context } from 'hono';
import { AliadoProductsService } from '../../services/aliado_products.service';
import { resolveDb } from '../../utils/request.utils';

export const getAllAliadoProducts = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  try {
    const products = await AliadoProductsService.getAll(db);
    return c.json({ success: true, data: products }, 200);
  } catch (err) {
    console.error('getAllAliadoProducts error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
