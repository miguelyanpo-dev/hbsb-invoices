import type { Context } from 'hono';
import { resolveDb } from '../../utils/request.utils';

export const getProductsQuantityByMonth = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const itemId = c.req.query('item_id');
  if (!itemId) {
    return c.json({ success: false, error: 'Bad Request', message: 'item_id is required' }, 400);
  }

  try {
    const { rows } = await db.query(
      `
      WITH months AS (
        SELECT 
          generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          )::date AS month_start
      ),
      monthly_data AS (
        SELECT 
          m.month_start,
          (ARRAY['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'])[EXTRACT(MONTH FROM m.month_start)::int]
            || ' ' || EXTRACT(YEAR FROM m.month_start)::text AS month,
          COALESCE(SUM(k.quantity), 0) AS quantity
        FROM months m
        LEFT JOIN kardex k ON DATE_TRUNC('month', k.invoice_date) = m.month_start
          AND k.item_id = $1
          AND k.invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
          AND k.deleted_at IS NULL
        GROUP BY m.month_start
        ORDER BY m.month_start DESC
      )
      SELECT month, quantity FROM monthly_data
      `,
      [itemId]
    );

    return c.json({ success: true, data: rows }, 200);
  } catch (err) {
    console.error('getProductsQuantityByMonth error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
