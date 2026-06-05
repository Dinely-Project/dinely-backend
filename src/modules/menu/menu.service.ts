import {
  countItemsByCategory,
  createCategory,
  createItem,
  deleteCategoryById,
  deleteItemById,
  getAllCategories,
  getAllItems,
  getCategoryById,
  getCategoryByName,
  getItemById,
  updateCategory,
  updateItem,
} from './menu.repository';
import { MenuCategory, MenuItem } from '../../types';

type CategoryInput = {
  name: string;
  description?: string;
  display_order?: number;
};

type CategoryUpdate = Partial<CategoryInput>;

type ItemInput = {
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_available?: boolean;
};

type ItemUpdate = Partial<ItemInput>;

type ItemFilters = {
  category_id?: string;
  search?: string;
  is_available?: boolean;
};

const normalizeCategoryPayload = (payload: CategoryInput): CategoryInput => ({
  name: payload.name.trim(),
  description: payload.description?.trim(),
  display_order: payload.display_order,
});

const normalizeItemPayload = (payload: ItemInput): ItemInput => ({
  category_id: payload.category_id,
  name: payload.name.trim(),
  description: payload.description?.trim(),
  price: payload.price,
  image_url: payload.image_url?.trim(),
  is_available: payload.is_available ?? true,
});

export const listCategories = async (): Promise<MenuCategory[]> => {
  return getAllCategories();
};

export const createMenuCategory = async (payload: CategoryInput): Promise<MenuCategory> => {
  const normalized = normalizeCategoryPayload(payload);
  const existing = await getCategoryByName(normalized.name);
  if (existing) {
    throw new Error('Category name already exists');
  }

  return createCategory({
    name: normalized.name,
    description: normalized.description ?? null,
    display_order: normalized.display_order ?? null,
  });
};

export const updateMenuCategory = async (
  id: string,
  payload: CategoryUpdate
): Promise<MenuCategory> => {
  const existing = await getCategoryById(id);
  if (!existing) {
    throw new Error('Category not found');
  }

  if (payload.name) {
    const normalizedName = payload.name.trim();
    const matched = await getCategoryByName(normalizedName);
    if (matched && matched.id !== id) {
      throw new Error('Category name already exists');
    }
  }

  return updateCategory(id, {
    name: payload.name?.trim() ?? undefined,
    description: payload.description?.trim() ?? undefined,
    display_order: payload.display_order,
  });
};

export const deleteMenuCategory = async (id: string): Promise<void> => {
  const existing = await getCategoryById(id);
  if (!existing) {
    throw new Error('Category not found');
  }

  const itemsCount = await countItemsByCategory(id);
  if (itemsCount > 0) {
    throw new Error('Category has assigned items');
  }

  await deleteCategoryById(id);
};

export const listMenuItems = async (filters: ItemFilters): Promise<MenuItem[]> => {
  const normalizedFilters = {
    ...filters,
    is_available: filters.is_available ?? true,
  };

  return getAllItems(normalizedFilters);
};

export const getMenuItem = async (id: string): Promise<MenuItem> => {
  const item = await getItemById(id);
  if (!item) {
    throw new Error('Item not found');
  }

  return item;
};

export const createMenuItem = async (payload: ItemInput): Promise<MenuItem> => {
  const category = await getCategoryById(payload.category_id);
  if (!category) {
    throw new Error('Category not found');
  }

  const normalized = normalizeItemPayload(payload);

  return createItem({
    category_id: normalized.category_id,
    name: normalized.name,
    description: normalized.description ?? null,
    price: normalized.price,
    image_url: normalized.image_url ?? null,
    is_available: normalized.is_available ?? true,
  });
};

export const updateMenuItem = async (id: string, payload: ItemUpdate): Promise<MenuItem> => {
  const existing = await getItemById(id);
  if (!existing) {
    throw new Error('Item not found');
  }

  if (payload.category_id) {
    const category = await getCategoryById(payload.category_id);
    if (!category) {
      throw new Error('Category not found');
    }
  }

  return updateItem(id, {
    category_id: payload.category_id,
    name: payload.name?.trim(),
    description: payload.description === null ? null : payload.description?.trim(),
    price: payload.price,
    image_url: payload.image_url === null ? null : payload.image_url?.trim(),
    is_available: payload.is_available,
  });
};

export const deleteMenuItem = async (id: string): Promise<void> => {
  const existing = await getItemById(id);
  if (!existing) {
    throw new Error('Item not found');
  }

  await deleteItemById(id);
};

export const updateMenuItemAvailability = async (
  id: string,
  is_available: boolean
): Promise<MenuItem> => {
  const existing = await getItemById(id);
  if (!existing) {
    throw new Error('Item not found');
  }

  return updateItem(id, { is_available });
};
