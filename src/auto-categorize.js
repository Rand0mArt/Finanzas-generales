// ==============================
// Auto-Categorization Engine
// ==============================

/**
 * Suggest category based on description text from historical data and user rules.
 * @param {string} description - Transaction description
 * @param {Array} availableCategories - Categories for current wallet
 * @param {Array} userRules - Learned user rules
 * @param {Array} historicalMatches - Recent Supabase matches
 * @returns {{ category: string|null, type: string|null, isFallback: boolean, walletId: string|null }}
 */
export function suggestCategoryFromHistory(description, availableCategories = [], userRules = [], historicalMatches = []) {
    if (!description) return { category: 'Por Clasificar', type: 'expense', isFallback: true, walletId: null };

    const lower = description.toLowerCase().trim();

    // 1. Check User Rules first
    for (const rule of userRules) {
        if (lower.includes(rule.keywords[0] || rule.keywords)) {
            const cat = availableCategories.find(c =>
                c.name.toLowerCase() === (rule.category || '').toLowerCase()
            );
            if (cat) return { category: cat.name, type: rule.type || cat.type, isFallback: false, walletId: null };
        }
    }

    // 2. Check Supabase Historical Transactions
    // historicalMatches is already sorted by date descending from Supabase, take the first valid one
    const pastMatch = historicalMatches.find(tx =>
        tx.description && tx.description.toLowerCase().trim() === lower && (tx.categories?.name || tx.category_name)
    );

    if (pastMatch) {
        const catName = pastMatch.categories?.name || pastMatch.category_name;
        const catObj = availableCategories.find(c => c.name === catName);
        return {
            category: catObj ? catObj.name : catName,
            type: pastMatch.type,
            isFallback: false,
            walletId: pastMatch.wallet_id // Helpful to suggest taking the transaction to another wallet
        };
    }

    // 3. Fallback
    return { category: 'Por Clasificar', type: 'expense', isFallback: true, walletId: null };
}

/**
 * Auto-fill missing fields intelligently
 */
export function autoFillTransaction(tx, availableCategories = [], userRules = [], historicalMatches = []) {
    const result = { ...tx };

    // Auto-categorize if missing
    if (!result.category_name && result.description) {
        const suggestion = suggestCategoryFromHistory(result.description, availableCategories, userRules, historicalMatches);
        if (suggestion.category) {
            result.category_name = suggestion.category;
            if (!result.type && suggestion.type) {
                result.type = suggestion.type;
            }
        }
    }

    // Auto-set date to today if missing
    if (!result.date) {
        result.date = new Date().toISOString().split('T')[0];
    }

    return result;
}
