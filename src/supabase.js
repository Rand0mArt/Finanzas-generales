// ==============================
// Supabase Client
// ==============================
import { createClient } from '@supabase/supabase-js';

let supabase = null;

/**
 * Initialize or re-initialize the Supabase client.
 * Reads from env vars first, then localStorage fallback.
 */
export function initSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('fg_supabase_url') || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('fg_supabase_key') || '';

  if (url && key) {
    supabase = createClient(url, key);
    return true;
  }
  return false;
}

export function saveSupabaseConfig(url, key) {
  localStorage.setItem('fg_supabase_url', url);
  localStorage.setItem('fg_supabase_key', key);
  return initSupabase();
}

export function getSupabase() {
  return supabase;
}

export function isConnected() {
  return supabase !== null;
}

// ==============================
// CRUD Operations
// ==============================

// --- Wallets ---
export async function fetchWallets() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('wallets').select('*').order('created_at');
  if (error) { console.error('fetchWallets error:', error); return []; }
  return data || [];
}

export async function createWallet(wallet) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('wallets').insert(wallet).select().single();
  if (error) { console.error('createWallet error:', error); return null; }
  return data;
}

// --- Categories ---
export async function fetchCategories(walletId) {
  if (!supabase) return [];
  let query = supabase.from('categories').select('*').order('sort_order');
  if (walletId) query = query.eq('wallet_id', walletId);
  const { data, error } = await query;
  if (error) { console.error('fetchCategories error:', error); return []; }
  return data || [];
}

export async function createCategory(category) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('categories').insert(category).select().single();
  if (error) { console.error('createCategory error:', error); return null; }
  return data;
}

// --- Transactions ---
export async function fetchTransactions(walletId, startDate, endDate, sortOrder = 'desc') {
  if (!supabase) return [];
  const ascending = sortOrder === 'asc';
  let query = supabase.from('transactions').select('*, categories(name, icon)')
    .order('date', { ascending })
    .order('created_at', { ascending });

  if (walletId) query = query.eq('wallet_id', walletId);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) { console.error('fetchTransactions error:', error); return []; }
  return data || [];
}

export async function fetchAnnualTransactions(walletId, year) {
  if (!supabase) return [];
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  let query = supabase.from('transactions')
    .select('date, type, amount')
    .order('date', { ascending: true });

  if (walletId) query = query.eq('wallet_id', walletId);
  query = query.gte('date', startDate).lte('date', endDate);

  const { data, error } = await query;
  if (error) { console.error('fetchAnnualTransactions error:', error); return []; }
  return data || [];
}

export async function searchHistoricalTransactions(queryText, limit = 5) {
  if (!supabase || !queryText) return [];
  const { data, error } = await supabase.from('transactions')
    .select('*, categories(name, icon)')
    .ilike('description', `%${queryText}%`)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.error('Historical search error:', error); return []; }
  return data || [];
}

export async function createTransaction(tx) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('transactions').insert(tx).select('*, categories(name, icon)').single();
  if (error) { console.error('createTransaction error:', error); return null; }
  return data;
}

export async function updateTransaction(id, updates) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select('*, categories(name, icon)').single();
  if (error) { console.error('updateTransaction error:', error); return null; }
  return data;
}

export async function deleteTransaction(id) {
  if (!supabase) return false;
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) { console.error('deleteTransaction error:', error); return false; }
  return true;
}

// --- Goals ---
export async function fetchGoals() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('goals')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchGoals error:', error); return []; }
  return data || [];
}

export async function createGoal(goal) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('goals').insert(goal).select().single();
  if (error) { console.error('createGoal error:', error); return null; }
  return data;
}

export async function updateGoal(id, updates) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('goals').update(updates).eq('id', id).select().single();
  if (error) { console.error('updateGoal error:', error); return null; }
  return data;
}

export async function deleteGoal(id) {
  if (!supabase) return false;
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) { console.error('deleteGoal error:', error); return false; }
  return true;
}

// --- Goal History ---
export async function fetchGoalHistory(goalId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('goal_history')
    .select('*')
    .eq('goal_id', goalId)
    .order('date', { ascending: false })
    .limit(10);
  if (error) { console.error('fetchGoalHistory error:', error); return []; }
  return data || [];
}

export async function addGoalFundWithHistory(goalId, amount, notes, date) {
  if (!supabase) return null;

  // Insert history record
  const { error: hErr } = await supabase.from('goal_history').insert({
    goal_id: goalId,
    amount,
    notes: notes || '',
    date: date || new Date().toISOString().split('T')[0]
  });
  if (hErr) { console.error('addGoalFundWithHistory history error:', hErr); }

  // Fetch current goal to calculate new amount
  const { data: goal, error: gErr } = await supabase
    .from('goals').select('current_amount, target_amount').eq('id', goalId).single();
  if (gErr) { console.error('addGoalFundWithHistory fetch goal error:', gErr); return null; }

  const newAmount = (parseFloat(goal.current_amount) || 0) + parseFloat(amount);
  const isCompleted = newAmount >= parseFloat(goal.target_amount || 0);

  const { data: updated, error: uErr } = await supabase
    .from('goals').update({ current_amount: newAmount, status: isCompleted ? 'completed' : 'active' })
    .eq('id', goalId).select().single();
  if (uErr) { console.error('addGoalFundWithHistory update error:', uErr); return null; }

  return { updated, newAmount, isCompleted };
}

// --- Fixed Expenses ---
export async function fetchFixedExpenses(walletId) {
  if (!supabase) return [];
  let query = supabase.from('fixed_expenses')
    .select('*')
    .eq('is_active', true)
    .order('day_of_month', { ascending: true });
  if (walletId) query = query.eq('wallet_id', walletId);
  const { data, error } = await query;
  if (error) { console.error('fetchFixedExpenses error:', error); return []; }
  return data || [];
}

export async function createFixedExpense(fe) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('fixed_expenses').insert(fe).select().single();
  if (error) { console.error('createFixedExpense error:', error); return null; }
  return data;
}

export async function updateFixedExpense(id, updates) {
  if (!supabase) return null;
  // Remove undefined values
  const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
  const { data, error } = await supabase.from('fixed_expenses').update(clean).eq('id', id).select().single();
  if (error) { console.error('updateFixedExpense error:', error); return null; }
  return data;
}

export async function deleteFixedExpense(id) {
  if (!supabase) return false;
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
  if (error) { console.error('deleteFixedExpense error:', error); return false; }
  return true;
}

// --- Fiat Accounts (legacy) ---
export async function fetchAccounts() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('fiat_accounts').select('*').order('created_at');
  if (error) { console.error('fetchAccounts error:', error); return []; }
  return data || [];
}

// ==============================
// Sync: Load all data from Supabase
// ==============================
export async function syncFromSupabase() {
  if (!supabase) return null;

  try {
    const [wallets, categories, goals] = await Promise.all([
      fetchWallets(),
      fetchCategories(),
      fetchGoals(),
    ]);

    if (wallets.length === 0) return null;

    const categoriesByWallet = {};
    wallets.forEach(w => { categoriesByWallet[w.id] = []; });
    categories.forEach(c => {
      if (categoriesByWallet[c.wallet_id]) {
        categoriesByWallet[c.wallet_id].push(c);
      }
    });

    return { wallets, categories: categoriesByWallet, goals };
  } catch (err) {
    console.error('syncFromSupabase error:', err);
    return null;
  }
}

// ==============================
// Realtime Subscriptions
// ==============================
export function subscribeToTransactions(callback) {
  if (!supabase) return null;

  return supabase
    .channel('custom-all-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      (payload) => {
        console.log('Realtime transaction update:', payload);
        callback(payload);
      }
    )
    .subscribe();
}

// Auto-init on import
initSupabase();
