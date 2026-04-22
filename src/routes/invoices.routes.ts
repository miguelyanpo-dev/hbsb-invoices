import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { resolveDb, buildPaginatedResponse, IdParamSchema } from '../utils/request.utils';
import { ErrorResponse, SuccessResponse } from '../schemas/response.schemas';
import {
  CreateInvoiceBodySchema,
  DbRefQuerySchema,
  DeleteInvoiceBodySchema,
  GetInvoiceQuerySchema,
  SelectInvoiceQuerySchema,
  UpdateInvoiceBodySchema,
} from '../schemas/invoices.schemas';
import {
  buildInvoiceDynamicFilters,
  createInvoice,
  getInvoiceById,
  listInvoices,
  parseInvoiceFields,
  softDeleteInvoice,
  updateInvoice,
} from '../services/invoices.service';

export const registerInvoicesRoutes = (apiV1: OpenAPIHono) => {
  const listInvoicesRoute = createRoute({
    method: 'get',
    path: '/invoices',
    tags: ['Invoices'],
    summary: 'Listar facturas',
    description: 'Retorna facturas con soporte de fields, filtros dinámicos y paginación.',
    request: { query: SelectInvoiceQuerySchema },
    responses: {
      200: {
        description: 'Facturas listadas correctamente',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: {
        description: 'Error de validación o petición inválida',
        content: { 'application/json': { schema: ErrorResponse } },
      },
    },
  });

  apiV1.openapi(listInvoicesRoute, (async (c) => {
    const resolved = resolveDb(c);
    if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);

    const parsedQuery = SelectInvoiceQuerySchema.safeParse(c.req.query());
    if (!parsedQuery.success) {
      return c.json(
        {
          success: false,
          error: 'Bad Request',
          message: parsedQuery.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { db } = resolved;
    const queryParams = c.req.query();
    const {
      page,
      limit,
      sort_by,
      sort_order,
      include_deleted,
      balance_amount_defeated,
      fields,
    } = parsedQuery.data;

    let selectedFields = '*';
    try {
      selectedFields = parseInvoiceFields(fields);
    } catch (error) {
      return c.json(
        { success: false, error: 'Bad Request', message: (error as Error).message },
        400,
      );
    }

    const { whereClauses, values } = buildInvoiceDynamicFilters(queryParams);
    if (balance_amount_defeated) {
      whereClauses.push('i.balance_amount > 0');
      whereClauses.push('i.due_date < CURRENT_DATE');
    }
    if (!include_deleted) whereClauses.push('i.deleted_at IS NULL');

    const { data, total } = await listInvoices(db, {
      selectedFields,
      whereClauses,
      whereValues: values,
      page,
      limit,
      sortBy: sort_by,
      sortOrder: sort_order,
    });

    return c.json(buildPaginatedResponse(data, total, page, limit), 200);
  }) as any);

  const getInvoiceRoute = createRoute({
    method: 'get',
    path: '/invoices/{id}',
    tags: ['Invoices'],
    summary: 'Obtener factura por id',
    request: {
      params: IdParamSchema,
      query: GetInvoiceQuerySchema,
    },
    responses: {
      200: { description: 'Factura encontrada', content: { 'application/json': { schema: SuccessResponse } } },
      404: { description: 'Factura no encontrada', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  apiV1.openapi(getInvoiceRoute, (async (c) => {
    const resolved = resolveDb(c);
    if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);

    const parsedId = IdParamSchema.safeParse(c.req.param());
    const parsedQuery = GetInvoiceQuerySchema.safeParse(c.req.query());

    if (!parsedId.success || !parsedQuery.success) {
      return c.json({ success: false, error: 'Bad Request', message: 'Invalid parameters' }, 400);
    }

    const { db } = resolved;
    const { id } = parsedId.data;
    const { fields, include_deleted } = parsedQuery.data;

    let selectedFields = '*';
    try {
      selectedFields = parseInvoiceFields(fields);
    } catch (error) {
      return c.json(
        { success: false, error: 'Bad Request', message: (error as Error).message },
        400,
      );
    }

    const invoice = await getInvoiceById(db, Number(id), selectedFields, include_deleted);
    if (!invoice) {
      return c.json({ success: false, error: 'Not Found', message: 'Invoice not found' }, 404);
    }

    return c.json({ success: true, data: invoice }, 200);
  }) as any);

  const createInvoiceRoute = createRoute({
    method: 'post',
    path: '/invoices',
    tags: ['Invoices'],
    summary: 'Crear factura',
    request: {
      query: DbRefQuerySchema,
      body: {
        content: { 'application/json': { schema: CreateInvoiceBodySchema } },
      },
    },
    responses: {
      201: { description: 'Factura creada', content: { 'application/json': { schema: SuccessResponse } } },
      400: { description: 'Body inválido', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  apiV1.openapi(createInvoiceRoute, (async (c) => {
    const resolved = resolveDb(c);
    if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);

    const bodyRaw = await c.req.json().catch(() => null);
    const parsedBody = CreateInvoiceBodySchema.safeParse(bodyRaw);
    if (!parsedBody.success) {
      return c.json(
        { success: false, error: 'Bad Request', message: parsedBody.error.flatten().fieldErrors },
        400,
      );
    }

    const { db } = resolved;
    try {
      const invoice = await createInvoice(db, parsedBody.data);
      return c.json({ success: true, data: invoice }, 201);
    } catch (error) {
      return c.json({ success: false, error: 'Bad Request', message: (error as Error).message }, 400);
    }
  }) as any);

  const updateInvoiceRoute = createRoute({
    method: 'patch',
    path: '/invoices/{id}',
    tags: ['Invoices'],
    summary: 'Actualizar factura',
    request: {
      params: IdParamSchema,
      query: DbRefQuerySchema,
      body: { content: { 'application/json': { schema: UpdateInvoiceBodySchema } } },
    },
    responses: {
      200: { description: 'Factura actualizada', content: { 'application/json': { schema: SuccessResponse } } },
      404: { description: 'Factura no encontrada', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  apiV1.openapi(updateInvoiceRoute, (async (c) => {
    const resolved = resolveDb(c);
    if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);

    const parsedId = IdParamSchema.safeParse(c.req.param());
    if (!parsedId.success) {
      return c.json({ success: false, error: 'Bad Request', message: 'Invalid invoice id' }, 400);
    }

    const bodyRaw = await c.req.json().catch(() => null);
    const parsedBody = UpdateInvoiceBodySchema.safeParse(bodyRaw);
    if (!parsedBody.success) {
      return c.json(
        { success: false, error: 'Bad Request', message: parsedBody.error.flatten().fieldErrors },
        400,
      );
    }

    const { db } = resolved;
    let invoice = null;
    try {
      invoice = await updateInvoice(db, Number(parsedId.data.id), parsedBody.data);
    } catch (error) {
      return c.json({ success: false, error: 'Bad Request', message: (error as Error).message }, 400);
    }

    if (!invoice) {
      return c.json({ success: false, error: 'Not Found', message: 'Invoice not found' }, 404);
    }

    return c.json({ success: true, data: invoice }, 200);
  }) as any);

  const deleteInvoiceRoute = createRoute({
    method: 'delete',
    path: '/invoices/{id}',
    tags: ['Invoices'],
    summary: 'Eliminar factura (soft delete)',
    request: {
      params: IdParamSchema,
      query: DbRefQuerySchema,
      body: { content: { 'application/json': { schema: DeleteInvoiceBodySchema } } },
    },
    responses: {
      200: { description: 'Factura eliminada', content: { 'application/json': { schema: SuccessResponse } } },
      404: { description: 'Factura no encontrada', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  apiV1.openapi(deleteInvoiceRoute, (async (c) => {
    const resolved = resolveDb(c);
    if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);

    const parsedId = IdParamSchema.safeParse(c.req.param());
    if (!parsedId.success) {
      return c.json({ success: false, error: 'Bad Request', message: 'Invalid invoice id' }, 400);
    }

    const bodyRaw = await c.req.json().catch(() => ({}));
    const parsedBody = DeleteInvoiceBodySchema.safeParse(bodyRaw);
    if (!parsedBody.success) {
      return c.json(
        { success: false, error: 'Bad Request', message: parsedBody.error.flatten().fieldErrors },
        400,
      );
    }

    const { db } = resolved;
    const invoice = await softDeleteInvoice(
      db,
      Number(parsedId.data.id),
      parsedBody.data.deleted_by_user_id ?? null,
    );
    if (!invoice) {
      return c.json({ success: false, error: 'Not Found', message: 'Invoice not found' }, 404);
    }

    return c.json({ success: true, data: invoice }, 200);
  }) as any);
};
