import type { Context } from 'hono';
import { AliadoProductsService } from '../../services/aliado_products.service';
import { resolveDb, IdParamSchema } from '../../utils/request.utils';

export const getAliadoProductById = async (c: Context) => {
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

  try {
    const product = await AliadoProductsService.getById(db, Number(parsedId.data.id));
    if (!product) {
      return c.json({ success: false, error: 'Not Found', message: 'Product not found' }, 404);
    }
    return c.json({ success: true, data: product }, 200);
  } catch (err) {
    console.error('getAliadoProductById error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
