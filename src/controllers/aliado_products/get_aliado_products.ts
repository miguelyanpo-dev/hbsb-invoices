import type { Context } from 'hono';
import { GetAliadoProductsQuerySchema } from '../../schemas/products.schemas';
import { AliadoProductsService } from '../../services/aliado_products.service';
import { resolveDb, buildPaginatedResponse } from '../../utils/request.utils';

export const getAliadoProducts = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const parsed = GetAliadoProductsQuerySchema.safeParse(c.req.query());

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
    item_id: parsed.data.item_id,
    item_code: parsed.data.item_code,
    item_name: parsed.data.item_name,
  };

  try {
    const { rows, total } = await AliadoProductsService.getPaginated(db, filters);
    return c.json(buildPaginatedResponse(rows, total, page, limit), 200);
  } catch (err) {
    console.error('getAliadoProducts error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
