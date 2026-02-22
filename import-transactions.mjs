import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env manually
const envPath = path.resolve('/Users/dhashdhasher/Documents/Apps/AntiG/efe/.env');
if (!fs.existsSync(envPath)) {
    console.error('.env file not found!');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim().replace(/^['"]|['"]$/g, '');
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importData() {
    try {
        // Read transactions
        const transactions = JSON.parse(fs.readFileSync('transactions.json', 'utf-8'));
        console.log(`Loaded ${transactions.length} transactions to import.`);

        // Get Wallet
        let { data: wallets, error: wErr } = await supabase.from('wallets').select('*').limit(1);
        if (wErr) throw wErr;

        let walletId;
        if (wallets.length === 0) {
            console.log('No wallets found. Creating default wallet...');
            const { data: newWallet, error: nwErr } = await supabase.from('wallets').insert({ name: 'Imported Wallet', icon: '💰' }).select().single();
            if (nwErr) throw nwErr;
            walletId = newWallet.id;
        } else {
            walletId = wallets[0].id;
            console.log(`Using existing wallet: ${wallets[0].name} (${walletId})`);
        }

        // Get Categories
        const { data: categories, error: cErr } = await supabase.from('categories').select('*').eq('wallet_id', walletId);
        if (cErr) throw cErr;

        // Create Category Map (Name -> ID)
        // Normalize names: lowercase, trim
        const catMap = {};
        categories.forEach(c => catMap[c.name.toLowerCase()] = c.id);
        console.log('Existing Categories:', Object.keys(catMap));

        // Processing Transactions
        let importedCount = 0;

        for (const tx of transactions) {
            // Category Matching
            // Raw category: "🏠 Renta" -> "renta" (remove emoji?)
            let categoryId = null;
            let rawCat = (tx.category_raw || 'General').trim();

            // Remove emojis regex
            const cleanCatName = rawCat.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
            const searchName = cleanCatName.toLowerCase();

            if (catMap[searchName]) {
                categoryId = catMap[searchName];
            } else {
                // Try fuzzy match or creating new?
                // For now, let's create it if it doesn't exist?
                // Or map to General if cleanCatName is empty.
                if (!cleanCatName) {
                    // Try finding "general" or "otros"
                    categoryId = catMap['general'] || catMap['otros'];
                } else {
                    // Create new category!
                    console.log(`Creating new category: ${cleanCatName} (based on ${rawCat})`);
                    const iconMatch = rawCat.match(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g);
                    const icon = iconMatch ? iconMatch[0] : '🏷️';

                    const { data: newCat, error: ncErr } = await supabase.from('categories').insert({
                        wallet_id: walletId,
                        name: cleanCatName || rawCat,
                        icon: icon,
                        type: tx.type // expense/income based on first usage
                    }).select().single();

                    if (ncErr) {
                        console.error('Error creating category:', ncErr);
                        // Fallback to null (Uncategorized)
                    } else {
                        categoryId = newCat.id;
                        catMap[cleanCatName.toLowerCase()] = categoryId; // Cache it
                    }
                }
            }

            // Insert Transaction
            const { error: iErr } = await supabase.from('transactions').insert({
                wallet_id: walletId,
                amount: tx.amount,
                date: tx.date, // ISO string
                description: tx.description,
                category_id: categoryId, // Can be null
                type: tx.type
            });

            if (iErr) {
                console.error(`Failed to import tx: ${tx.description}`, iErr);
            } else {
                importedCount++;
            }
        }

        console.log(`Successfully imported ${importedCount} transactions.`);

    } catch (e) {
        console.error('Import failed:', e);
    }
}

importData();
