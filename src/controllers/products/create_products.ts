import type { Context } from 'hono';
import { CreateProductsSchema } from '../../schemas/products.schemas';
import { KardexService } from '../../services/products.service';
import { resolveDb } from '../../utils/request.utils';
import { ConflictError } from '../../utils/errors';

export const createKardex = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const body = await c.req.json().catch(() => null);
  const parsed = CreateProductsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: parsed.error.message },
      400
    );
  }

  try {
    const data = await KardexService.create(db, parsed.data);
    return c.json({ success: true, data }, 201);
  } catch (err) {
    if (err instanceof ConflictError) {
      return c.json({ success: false, error: 'Conflict', message: err.message }, 409);
    }
    console.error('createKardex error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
