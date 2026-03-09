import type { Context } from 'hono';
import { GetKardexProductsSoldQuerySchema } from '../../schemas/products.schemas';
import { KardexProductsSoldService } from '../../services/kardex_products_sold.service';
import { resolveDb, buildPaginatedResponse } from '../../utils/request.utils';

export const getKardexProductsSold = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const parsed = GetKardexProductsSoldQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: parsed.error.message },
      400
    );
  }

  const page = Number(parsed.data.page ?? 1);
  const limit = Number(parsed.data.limit ?? 1000);

  const filters = {
    page,
    limit,
    invoice_id: parsed.data.invoice_id,
    person_id: parsed.data.person_id,
    item_id: parsed.data.item_id,
    date_start: parsed.data.date_start,
    date_end: parsed.data.date_end,
  };

  try {
    const { rows, total } = await KardexProductsSoldService.getPaginated(db, filters);
    return c.json(buildPaginatedResponse(rows, total, page, limit), 200);
  } catch (err) {
    console.error('getKardexProductsSold error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
