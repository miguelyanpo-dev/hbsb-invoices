import type { Context } from 'hono';
import { resolveDb } from '../../utils/request.utils';

export const getTopCustomersByProduct = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const itemId = c.req.query('item_id');
  if (!itemId) {
    return c.json({ success: false, error: 'Bad Request', message: 'item_id is required' }, 400);
  }

  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '10', 10);

  if (limit < 1 || limit > 1000) {
    return c.json(
      { success: false, error: 'Bad Request', message: 'Limit must be between 1 and 1000' },
      400
    );
  }

  try {
    // ── Conteo total de clientes (1 query) ────────────────────────────────────
    const totalResult = await db.query(
      `
      SELECT COUNT(DISTINCT person_name)::int AS total
      FROM kardex 
      WHERE item_id = $1 
        AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
        AND deleted_at IS NULL
        AND person_name IS NOT NULL
      `,
      [itemId]
    );

    const totalCustomers = totalResult.rows[0]?.total ?? 0;
    const totalPages = Math.ceil(totalCustomers / limit);
    const offset = (page - 1) * limit;

    // ── Top clientes + distribución mensual en UNA SOLA QUERY (resuelve N+1) ──
    //
    //  Antes: 1 query para el top + N queries (una por cliente) para los meses.
    //  Ahora: 1 query con CROSS JOIN meses x clientes + LEFT JOIN kardex.
    //  La lógica de pivoteo (filas → objeto meses{}) se hace en JS.
    //
    const dataResult = await db.query(
      `
      WITH top_customers AS (
        SELECT 
          person_name,
          SUM(quantity)::bigint AS total_quantity
        FROM kardex 
        WHERE item_id = $1 
          AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
          AND deleted_at IS NULL
          AND person_name IS NOT NULL
        GROUP BY person_name
        ORDER BY total_quantity DESC
        LIMIT $2 OFFSET $3
      ),
      months AS (
        SELECT 
          generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          )::date AS month_start
      ),
      monthly_by_customer AS (
        SELECT
          tc.person_name,
          tc.total_quantity,
          m.month_start,
          (ARRAY['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'])[EXTRACT(MONTH FROM m.month_start)::int]
            || ' ' || EXTRACT(YEAR FROM m.month_start)::text AS month_label,
          COALESCE(SUM(k.quantity), 0)::bigint AS quantity
        FROM top_customers tc
        CROSS JOIN months m
        LEFT JOIN kardex k
          ON DATE_TRUNC('month', k.invoice_date) = m.month_start
          AND k.item_id = $1
          AND k.person_name = tc.person_name
          AND k.deleted_at IS NULL
        GROUP BY tc.person_name, tc.total_quantity, m.month_start, month_label
      )
      SELECT
        person_name,
        total_quantity,
        month_label,
        quantity,
        month_start
      FROM monthly_by_customer
      ORDER BY total_quantity DESC, month_start DESC
      `,
      [itemId, limit, offset]
    );

    // ── Pivotear filas a la estructura { client_name, cantidad_total, meses } ─
    const customerMap = new Map<string, { client_name: string; cantidad_total: string; meses: Record<string, string> }>();

    for (const row of dataResult.rows) {
      if (!customerMap.has(row.person_name)) {
        customerMap.set(row.person_name, {
          client_name: row.person_name,
          cantidad_total: row.total_quantity.toString(),
          meses: {},
        });
      }
      customerMap.get(row.person_name)!.meses[row.month_label] = row.quantity.toString();
    }

    const data = Array.from(customerMap.values());

    return c.json({
      success: true,
      data,
      data_items: totalCustomers,
      page_current: page,
      page_total: totalPages,
      have_next_page: page < totalPages,
      have_previous_page: page > 1,
    }, 200);
  } catch (err) {
    console.error('getTopCustomersByProduct error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
