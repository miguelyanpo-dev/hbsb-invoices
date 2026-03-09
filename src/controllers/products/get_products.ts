import type { Context } from 'hono';
import { GetProductsQuerySchema } from '../../schemas/products.schemas';
import { KardexService } from '../../services/products.service';
import { resolveDb, buildPaginatedResponse } from '../../utils/request.utils';

export const getKardex = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const query = c.req.query();

  // Convertir clients_ids de string separado por comas a array si es necesario
  if (query.clients_ids && typeof query.clients_ids === 'string') {
    (query as any).clients_ids = query.clients_ids.split(',').map((id: string) => id.trim());
  }

  const parsed = GetProductsQuerySchema.safeParse(query);
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
    date_start: parsed.data.date_start,
    date_end: parsed.data.date_end,
  };

  try {
    const { rows, total } = await KardexService.getPaginated(db, filters);
    return c.json(buildPaginatedResponse(rows, total, page, limit), 200);
  } catch (err) {
    console.error('getKardex error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
