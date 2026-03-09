import type { Context } from 'hono';
import { resolveDb } from '../../utils/request.utils';

export const getProductsNames = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  try {
    const { rows } = await db.query(
      `
      SELECT 
        id,
        item_id,
        item_code,
        item_name,
        item_image,
        item_description,
        item_price_sell_taxes,
        item_stock,
        item_combinated_names
      FROM aliado_products
      WHERE deleted_at IS NULL
      ORDER BY item_name ASC
      `
    );
    return c.json({ success: true, data: rows }, 200);
  } catch (err) {
    console.error('getProductsNames error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
