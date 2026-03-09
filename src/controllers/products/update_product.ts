import type { Context } from 'hono';
import { UpdateProductsSchema } from '../../schemas/products.schemas';
import { KardexService } from '../../services/products.service';
import { resolveDb, IdParamSchema } from '../../utils/request.utils';

export const updateKardex = async (c: Context) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const parsedId = IdParamSchema.safeParse(c.req.param());
  if (!parsedId.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: 'Invalid ID format' },
      400
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsedBody = UpdateProductsSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json(
      { success: false, error: 'Bad Request', message: parsedBody.error.message },
      400
    );
  }

  try {
    const data = await KardexService.update(db, Number(parsedId.data.id), parsedBody.data);
    if (!data) {
      return c.json({ success: false, error: 'Not Found', message: 'Note not found' }, 404);
    }
    return c.json({ success: true, data }, 200);
  } catch (err) {
    console.error('updateKardex error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};
