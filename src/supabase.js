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

/**
 * Save Supabase credentials to localStorage and reinit.
 */
export function saveSupabaseConfig(url, key) {
  localStorage.setItem('fg_supabase_url', url);
  localStorage.setItem('fg_supabase_key', key);
  return initSupabase();
}

/**
 * Get the Supabase client. Returns null if not configured.
 */
export function getSupabase() {
  return supabase;
}

/**
 * Check if Supabase is connected.
 */
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
export async function fetchTransactions(walletId, startDate, endDate) {
  if (!supabase) return [];
  let query = supabase.from('transactions').select('*, categories(name, icon)')
    .eq('wallet_id', walletId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) { console.error('fetchTransactions error:', error); return []; }
  return data || [];
}

export async function createTransaction(tx) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('transactions').insert(tx).select('*, categories(name, icon)').single();
  if (error) { console.error('createTransaction error:', error); return null; }
  return data;
}

export async function deleteTransaction(id) {
  if (!supabase) return false;
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) { console.error('deleteTransaction error:', error); return false; }
  return true;
}

// --- Debts ---
export async function fetchDebts(walletId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('debts').select('*')
    .eq('wallet_id', walletId)
    .order('created_at');
  if (error) { console.error('fetchDebts error:', error); return []; }
  return data || [];
}

export async function createDebt(debt) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('debts').insert(debt).select().single();
  if (error) { console.error('createDebt error:', error); return null; }
  return data;
}

export async function updateDebt(id, updates) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('debts').update(updates).eq('id', id).select().single();
  if (error) { console.error('updateDebt error:', error); return null; }
  return data;
}

// --- Fiat Accounts ---
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
    const [wallets, categories, accounts] = await Promise.all([
      fetchWallets(),
      fetchCategories(),
      fetchAccounts(),
    ]);

    if (wallets.length === 0) return null;

    // Group categories by wallet_id
    const categoriesByWallet = {};
    wallets.forEach(w => { categoriesByWallet[w.id] = []; });
    categories.forEach(c => {
      if (categoriesByWallet[c.wallet_id]) {
        categoriesByWallet[c.wallet_id].push(c);
      }
    });

    return { wallets, categories: categoriesByWallet, accounts };
  } catch (err) {
    console.error('syncFromSupabase error:', err);
    return null;
  }
}

// Auto-init on import
initSupabase();
