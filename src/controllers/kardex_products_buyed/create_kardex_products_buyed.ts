import type { Context } from 'hono';
import { CreateKardexProductsBuyedSchema } from '../../schemas/products.schemas';
import { KardexProductsBuyedService } from '../../services/kardex_products_buyed.service';
import { resolveDb } from '../../utils/request.utils';
import { ConflictError } from '../../utils/errors';

export const createKardexProductsBuyed = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const body = await c.req.json().catch(() => null);
  const parsed = CreateKardexProductsBuyedSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: parsed.error.message },
      400
    );
  }

  try {
    const product = await KardexProductsBuyedService.create(db, parsed.data);
    return c.json({ success: true, data: product }, 201);
  } catch (err) {
    if (err instanceof ConflictError) {
      return c.json({ success: false, error: 'Conflict', message: err.message }, 409);
    }
    console.error('createKardexProductsBuyed error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
