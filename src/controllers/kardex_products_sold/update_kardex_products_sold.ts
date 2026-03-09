import type { Context } from 'hono';
import { UpdateKardexProductsSoldSchema } from '../../schemas/products.schemas';
import { KardexProductsSoldService } from '../../services/kardex_products_sold.service';
import { resolveDb, IdParamSchema } from '../../utils/request.utils';

export const updateKardexProductsSold = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const parsedId = IdParamSchema.safeParse(c.req.param());
  if (!parsedId.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: parsedId.error.message },
      400
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = UpdateKardexProductsSoldSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: parsed.error.message },
      400
    );
  }

  try {
    const product = await KardexProductsSoldService.update(db, Number(parsedId.data.id), parsed.data);
    if (!product) {
      return c.json({ success: false, error: 'Not Found', message: 'Product not found' }, 404);
    }
    return c.json({ success: true, data: product }, 200);
  } catch (err) {
    console.error('updateKardexProductsSold error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
