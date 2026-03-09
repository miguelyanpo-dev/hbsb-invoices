import type { Context } from 'hono';
import { UpdateKardexProductsBuyedSchema } from '../../schemas/products.schemas';
import { KardexProductsBuyedService } from '../../services/kardex_products_buyed.service';
import { resolveDb, IdParamSchema } from '../../utils/request.utils';

export const updateKardexProductsBuyed = async (c: Context) => {
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
  const parsed = UpdateKardexProductsBuyedSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: parsed.error.message },
      400
    );
  }

  try {
    const product = await KardexProductsBuyedService.update(db, Number(parsedId.data.id), parsed.data);
    if (!product) {
      return c.json({ success: false, error: 'Not Found', message: 'Product not found' }, 404);
    }
    return c.json({ success: true, data: product }, 200);
  } catch (err) {
    console.error('updateKardexProductsBuyed error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
