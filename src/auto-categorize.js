// ==============================
// Auto-Categorization Engine
// ==============================

const RULES = [
    // Suscripciones
    {
        keywords: ['icloud', 'adobe', 'midjourney', 'canva', 'spotify', 'netflix', 'chatgpt', 'openai',
            'github', 'figma', 'notion', 'youtube premium', 'amazon prime', 'hbo', 'disney',
            'apple music', 'google one', 'dropbox', 'slack', 'zoom', 'claude', 'copilot'],
        category: 'Suscripciones',
        type: 'expense'
    },
    // Transporte
    {
        keywords: ['uber', 'didi', 'gasolina', 'estacionamiento', 'taxi', 'metro', 'metrobús',
            'cabify', 'autopista', 'caseta', 'peaje', 'beat'],
        category: 'Transporte',
        type: 'expense'
    },
    // Comida
    {
        keywords: ['oxxo', 'walmart', 'soriana', 'mercado', 'super', 'chedraui', 'costco',
            'sam\'s', 'rappi', 'uber eats', 'didi food', 'restaurante', 'comida',
            'despensa', 'bodega aurrera', 'la comer', 'starbucks', 'café'],
        category: 'Comida',
        type: 'expense'
    },
    // Salud
    {
        keywords: ['farmacia', 'doctor', 'hospital', 'salud', 'dentista', 'medicina',
            'consultorio', 'clínica', 'guadalajara', 'similares', 'san pablo', 'benavides'],
        category: 'Salud',
        type: 'expense'
    },
    // Servicios (utilities)
    {
        keywords: ['cfe', 'telmex', 'izzi', 'totalplay', 'megacable', 'axtel', 'agua',
            'gas', 'luz eléctrica', 'internet', 'teléfono', 'celular'],
        category: 'Servicios',
        type: 'expense'
    },
    // Personal
    {
        keywords: ['gym', 'gimnasio', 'ropa', 'zara', 'liverpool',
            'palacio de hierro', 'corte', 'peluquería'],
        category: 'Personal',
        type: 'expense'
    },
    // Mascotas
    {
        keywords: ['veterinario', 'petco', 'mascotas', 'croquetas', '+kota'],
        category: 'Mascotas',
        type: 'expense'
    },
    // Bebé
    {
        keywords: ['pañales', 'huggies', 'bebé', 'baby', 'fórmula', 'pediatra', 'leche'],
        category: 'Bebé',
        type: 'expense'
    },
    // Arte / Diseño income
    {
        keywords: ['cuadro', 'mural', 'tattoo', 'tatuaje', 'diseño', 'ilustración'],
        category: null, // handled by wallet type
        type: 'income'
    },
    // Materiales
    {
        keywords: ['material', 'pintura', 'lienzo', 'canvas', 'pinceles', 'tinta'],
        category: 'Materiales',
        type: 'expense'
    },
    // Renta
    {
        keywords: ['renta', 'alquiler', 'arrendamiento'],
        category: 'Renta',
        type: 'expense'
    },
];

/**
 * Suggest category based on description text.
 * @param {string} description - Transaction description
 * @param {Array} availableCategories - Categories for current wallet
 * @param {Array} userRules - Learned user rules
 * @param {Array} pastTransactions - History for inheritance
 * @returns {{ category: string|null, type: string|null, isFallback: boolean }}
 */
export function suggestCategory(description, availableCategories = [], userRules = [], pastTransactions = []) {
    if (!description) return { category: 'Por Clasificar', type: 'expense', isFallback: true };

    const lower = description.toLowerCase().trim();

    // 1. Check User Rules first
    for (const rule of userRules) {
        if (lower.includes(rule.keywords[0] || rule.keywords)) {
            const cat = availableCategories.find(c =>
                c.name.toLowerCase() === (rule.category || '').toLowerCase()
            );
            if (cat) return { category: cat.name, type: rule.type || cat.type, isFallback: false };
        }
    }

    // 2. Check Historical Transactions (Asignación Histórica)
    const pastMatch = pastTransactions.find(tx =>
        tx.description && tx.description.toLowerCase().trim() === lower && tx.categories
    );
    if (pastMatch) {
        const catName = pastMatch.categories?.name || pastMatch.category_name;
        const cat = availableCategories.find(c => c.name === catName);
        if (cat) return { category: cat.name, type: pastMatch.type, isFallback: false };
    }

    // 3. Check Default Rules
    for (const rule of RULES) {
        const match = rule.keywords.some(kw => lower.includes(kw));
        if (match) {
            const cat = availableCategories.find(c =>
                c.name.toLowerCase() === (rule.category || '').toLowerCase()
            );
            if (cat) return { category: cat.name, type: rule.type || cat.type, isFallback: false };
            if (rule.category) return { category: rule.category, type: rule.type, isFallback: false };
        }
    }

    // 4. Categoría por Defecto (Fallback)
    return { category: 'Por Clasificar', type: 'expense', isFallback: true };
}

/**
 * Get description suggestions based on partial input.
 */
export function getSuggestions(partial, previousDescriptions = []) {
    if (!partial || partial.length < 2) return [];

    const lower = partial.toLowerCase();
    const suggestions = new Set();

    // From previous descriptions
    previousDescriptions.forEach(desc => {
        if (desc.toLowerCase().includes(lower)) {
            suggestions.add(desc);
        }
    });

    // From known keywords
    RULES.forEach(rule => {
        rule.keywords.forEach(kw => {
            if (kw.includes(lower)) {
                suggestions.add(kw.charAt(0).toUpperCase() + kw.slice(1));
            }
        });
    });

    return [...suggestions].slice(0, 5);
}

/**
 * Auto-fill missing fields intelligently
 */
export function autoFillTransaction(tx, availableCategories = [], userRules = [], pastTransactions = []) {
    const result = { ...tx };

    // Auto-categorize if missing
    if (!result.category_name && result.description) {
        const suggestion = suggestCategory(result.description, availableCategories, userRules, pastTransactions);
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
