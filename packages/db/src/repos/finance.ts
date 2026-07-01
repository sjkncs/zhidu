// @zhidu/db — 收支记录（财务）

import { getDb } from '../utils';
import type { TransactionRow } from '../index';

// ─── Transactions (Finance) ─────────────────────────────────────────────────

export async function createTransaction(params: {
  userId: string;
  amount: number;
  category: string;
  description?: string;
  type: 'EXPENSE' | 'INCOME';
  date?: string;
}): Promise<TransactionRow | null> {
  try {
    const { data, error } = await getDb()
      .from('transactions')
      .insert({
        user_id: params.userId,
        amount: params.amount,
        category: params.category,
        description: params.description ?? null,
        type: params.type,
        date: params.date ?? new Date().toISOString().split('T')[0],
      })
      .select()
      .single();
    if (error) { console.error('[createTransaction]', error.message); return null; }
    return mapTransaction(data);
  } catch (err) {
    console.error('[createTransaction]', err);
    return null;
  }
}

export async function getUserTransactions(userId: string, filters?: {
  type?: 'EXPENSE' | 'INCOME';
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<TransactionRow[]> {
  try {
    let query = getDb()
      .from('transactions')
      .select('*')
      .eq('user_id', userId);
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    const { data, error } = await query
      .order('date', { ascending: false })
      .limit(filters?.limit ?? 200);
    if (error) { console.error('[getUserTransactions]', error.message); return []; }
    return (data ?? []).map(mapTransaction);
  } catch (err) {
    console.error('[getUserTransactions]', err);
    return [];
  }
}

export async function updateTransaction(id: string, updates: {
  amount?: number;
  category?: string;
  description?: string;
  type?: 'EXPENSE' | 'INCOME';
  date?: string;
}): Promise<TransactionRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    const { data, error } = await getDb()
      .from('transactions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateTransaction]', error.message); return null; }
    return mapTransaction(data);
  } catch (err) {
    console.error('[updateTransaction]', err);
    return null;
  }
}

export async function deleteTransaction(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('transactions').delete().eq('id', id);
    if (error) { console.error('[deleteTransaction]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteTransaction]', err);
    return false;
  }
}

function mapTransaction(row: any): TransactionRow {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    category: row.category,
    description: row.description,
    type: row.type,
    date: row.date,
    createdAt: row.created_at,
  };
}
