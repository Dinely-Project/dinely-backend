import { supabase } from '../../config/supabase';
import { MenuCategory, MenuItem } from '../../types';
import { MenuCategorySchema, MenuItemSchema } from '../../types/schemas';

type CategoryPayload = Omit<MenuCategory, 'id' | 'created_at' | 'updated_at'>;
type ItemPayload = Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>;

type ItemFilters = {
  category_id?: string;
  search?: string;
  is_available?: boolean;
};

export const getAllCategories = async (): Promise<MenuCategory[]> => {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  const rows = data as MenuCategory[] | null;
  return rows ? rows.map((row) => MenuCategorySchema.parse(row)) : [];
};

export const getCategoryById = async (id: string): Promise<MenuCategory | null> => {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch category by id: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return MenuCategorySchema.parse(data[0]);
};

export const getCategoryByName = async (name: string): Promise<MenuCategory | null> => {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('name', name)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch category by name: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return MenuCategorySchema.parse(data[0]);
};

export const createCategory = async (payload: CategoryPayload): Promise<MenuCategory> => {
  const { data, error } = await supabase
    .from('menu_categories')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create category: ${error?.message ?? 'No data returned'}`);
  }

  return MenuCategorySchema.parse(data);
};

export const updateCategory = async (
  id: string,
  payload: Partial<CategoryPayload>
): Promise<MenuCategory> => {
  const { data, error } = await supabase
    .from('menu_categories')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update category: ${error?.message ?? 'No data returned'}`);
  }

  return MenuCategorySchema.parse(data);
};

export const deleteCategoryById = async (id: string): Promise<void> => {
  const { error } = await supabase.from('menu_categories').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
};

export const countItemsByCategory = async (categoryId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId);

  if (error) {
    throw new Error(`Failed to count category items: ${error.message}`);
  }

  return count ?? 0;
};

export const getAllItems = async (filters: ItemFilters): Promise<MenuItem[]> => {
  let query = supabase.from('menu_items').select('*');

  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  if (filters.is_available !== undefined) {
    query = query.eq('is_available', filters.is_available);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`);
  }

  const rows = data as MenuItem[] | null;
  return rows ? rows.map((row) => MenuItemSchema.parse(row)) : [];
};

export const getItemById = async (id: string): Promise<MenuItem | null> => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch item by id: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return MenuItemSchema.parse(data[0]);
};

export const createItem = async (payload: ItemPayload): Promise<MenuItem> => {
  const { data, error } = await supabase
    .from('menu_items')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create item: ${error?.message ?? 'No data returned'}`);
  }

  return MenuItemSchema.parse(data);
};

export const updateItem = async (id: string, payload: Partial<ItemPayload>): Promise<MenuItem> => {
  const { data, error } = await supabase
    .from('menu_items')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update item: ${error?.message ?? 'No data returned'}`);
  }

  return MenuItemSchema.parse(data);
};

export const deleteItemById = async (id: string): Promise<void> => {
  const { error } = await supabase.from('menu_items').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete item: ${error.message}`);
  }
};
