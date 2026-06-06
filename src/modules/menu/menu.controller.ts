import { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  getMenuItem,
  listCategories,
  listMenuItems,
  updateMenuCategory,
  updateMenuItem,
  updateMenuItemAvailability,
} from './menu.service';
import {
  createCategorySchema,
  createItemSchema,
  updateAvailabilitySchema,
  updateCategorySchema,
  updateItemSchema,
} from './menu.validator';

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');

const getParamId = (req: Request): string =>
  Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

const booleanFromString = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

const listItemsSchema = z.object({
  category_id: z.string().uuid('Invalid category id').optional(),
  search: z.string().min(1).optional(),
  is_available: booleanFromString.optional(),
});

const MENU_ERROR_STATUS: Record<string, 400 | 404 | 409> = {
  'Category not found': 404,
  'Item not found': 404,
  'Category name already exists': 409,
  'Category has assigned items': 409,
};

const handleServiceError = (res: Response, error: unknown): Response => {
  if (error instanceof Error) {
    const status = MENU_ERROR_STATUS[error.message];
    if (status) {
      return res.status(status).json({ message: error.message });
    }
    console.error('[MenuError]', error.message, error.stack);
  } else {
    console.error('[MenuError] Unknown error:', error);
  }

  return res.status(500).json({ message: 'Internal server error' });
};

export const getCategories = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const categories = await listCategories();
    return res.status(200).json({ data: categories });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const createCategory = async (req: Request, res: Response): Promise<Response> => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const category = await createMenuCategory(parsed.data);
    return res.status(201).json({ message: 'Category created', data: category });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<Response> => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const category = await updateMenuCategory(getParamId(req), parsed.data);
    return res.status(200).json({ message: 'Category updated', data: category });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    await deleteMenuCategory(getParamId(req));
    return res.status(200).json({ message: 'Category deleted' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getItems = async (req: Request, res: Response): Promise<Response> => {
  const parsed = listItemsSchema.safeParse({
    category_id: req.query.category_id,
    search: req.query.search,
    is_available: req.query.is_available,
  });

  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const items = await listMenuItems(parsed.data);
    return res.status(200).json({ data: items });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getItem = async (req: Request, res: Response): Promise<Response> => {
  try {
    const item = await getMenuItem(getParamId(req));
    return res.status(200).json({ data: item });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const createItem = async (req: Request, res: Response): Promise<Response> => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const item = await createMenuItem(parsed.data);
    return res.status(201).json({ message: 'Item created', data: item });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateItem = async (req: Request, res: Response): Promise<Response> => {
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const item = await updateMenuItem(getParamId(req), parsed.data);
    return res.status(200).json({ message: 'Item updated', data: item });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const deleteItem = async (req: Request, res: Response): Promise<Response> => {
  try {
    await deleteMenuItem(getParamId(req));
    return res.status(200).json({ message: 'Item deleted' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateAvailability = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const parsed = updateAvailabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: formatZodError(parsed.error) });
  }

  try {
    const item = await updateMenuItemAvailability(getParamId(req), parsed.data.is_available);
    return res.status(200).json({ message: 'Availability updated', data: item });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
