import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const dataBuffer = fs.readFileSync('/Users/dhashdhasher/Documents/Apps/AntiG/efe/fg 1.pdf');

console.log('--- RE-PARSING PDF WITH AMOUNT-PIVOT STRATEGY ---');

async function parse() {
    try {
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        const text = result.text.replace(/\r/g, ''); // Normalize raw text

        // Regex for Amount: includes '$' or '-' followed by digits/commas/dots/parens
        // Example: $5,000.00, -$1400.00, $ (2,000), 1,100 (if plain number, strict?)
        // The PDF seems to always use '$' or '-' or '('.
        // Let's use a robust one matching the PDF examples.
        // Capturing group 1 is the amount.
        const amountRegexGlobal = /((?:[$€£]|-)\s*\(?[\d,.]+\)?)/g;

        // Split text by amounts.
        // split behavior with capture group: [pre, match, post, match, post...]
        // Actually: [chunk0, amount1, chunk1, amount2, chunk2, ...]
        const parts = text.split(amountRegexGlobal);

        const transactions = [];
        const currentYear = 2026;

        // i=0 is header/garbage before first amount.
        // amount1 is parts[1].
        // chunk1 is parts[2].
        // amount2 is parts[3].

        // Transaction N consists of:
        // Description/Date: From chunk(N-1)
        // Amount: amount(N)
        // Category: From start of chunk(N)

        // chunk(N) contains [Category of matching amount] + [Date/Desc of NEXT amount]

        // Date Regex
        const dateRegex = /(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)(?:\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4})((?:\s+\d{4})?)/i;

        for (let i = 1; i < parts.length; i += 2) {
            const rawAmount = parts[i].trim();
            const prevChunk = parts[i - 1]; // Contains Date + Desc
            const nextChunk = parts[i + 1] || ''; // Contains Category + Next Date

            // 1. Extract Date + Description from prevChunk
            // Look for the separate Date match closest to the END of prevChunk?
            // Actually, usually Date is at the START of the line.
            // But prevChunk might contain "Category of PREV tx" + "Date of CURR tx" + "Desc of CURR tx".
            // So we need to find the LAST date in prevChunk?
            // Or rather, we sliced nextChunk in the previous iteration.

            // Wait, this sliding window is tricky.
            // Let's parse each Tuple (Amount, Context).
            // But context is split.

            // Better approach:
            // Iterate amounts.
            // For Amount(i), we identify its boundaries in the original text? No.

            // Let's use the parts.
            // i=1 (Amount 1).
            // prevChunk (parts[0]) = "Garbage... Date1 Desc1".
            // nextChunk (parts[2]) = "Category1 Date2 Desc2".

            // Parse Date1 and Desc1 from parts[0].
            // Find the LAST date in parts[0]?
            const dateMatches = [...prevChunk.matchAll(new RegExp(dateRegex, 'gi'))];
            let date = '';
            let description = '';

            if (dateMatches.length > 0) {
                // Use the last detected date as the start of this transaction
                const lastDateMatch = dateMatches[dateMatches.length - 1];
                date = lastDateMatch[0];
                description = prevChunk.substring(lastDateMatch.index + date.length).trim();
            } else {
                // Formatting issue or continuation?
                // If it's the very first part, maybe just description?
                description = prevChunk.trim();
                date = `01 ene ${currentYear}`; // Default
            }

            // 2. Extract Category from nextChunk
            // Category is at the START of nextChunk.
            // It ends where the NEXT Date begins.
            // Or if no next date, it's just the category (last item).

            let category = '';
            const nextDateMatch = nextChunk.match(dateRegex);
            if (nextDateMatch) {
                category = nextChunk.substring(0, nextDateMatch.index).trim();
            } else {
                category = nextChunk.trim();
            }

            // Clean Amount
            let amountVal = rawAmount.replace(/[$,\s]/g, '');
            if (rawAmount.includes('(') && rawAmount.includes(')')) {
                amountVal = '-' + amountVal.replace(/[()]/g, '');
            }
            amountVal = parseFloat(amountVal);

            // Clean Category and Determine Type
            // Check for Gasto/Ingreso keywords or known emojis
            let type = 'expense'; // Default
            const cleanCat = category.toLowerCase();
            if (cleanCat.includes('ingresa') || cleanCat.includes('ingreso') || cleanCat.includes('cobro') || cleanCat.includes('✅')) {
                type = 'income';
            } else if (cleanCat.includes('gasto') || cleanCat.includes('pago') || cleanCat.includes('🔻')) {
                type = 'expense';
            } else {
                // Auto-detect based on amount sign
                // If amount is positive -> income? Not reliable if parsed from (2000).
                // Use default.
            }

            // Fix Date ISO
            let parseDate = date;
            if (parseDate.includes('/')) {
                const [d, m, y] = parseDate.split('/');
                parseDate = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            } else {
                // Spanish text
                if (!/\d{4}/.test(parseDate)) parseDate += ` ${currentYear}`;
                const months = {
                    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
                    'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
                };
                const parts = parseDate.split(/\s+/);
                // Handle "29 ene 2026" or "2 ene"
                const d = parts[0];
                const mName = parts[1].toLowerCase().substring(0, 3);
                const y = parts[2] || currentYear;
                const m = months[mName] || '01';
                parseDate = `${y}-${m}-${d.padStart(2, '0')}`;
            }

            transactions.push({
                date: parseDate,
                description: description.replace(/\s+/g, ' ').trim(),
                amount: amountVal,
                category_raw: category.replace(/\s+/g, ' ').trim(),
                type: type,
                original_amount: rawAmount
            });
        }

        console.log(`Extracted ${transactions.length} transactions.`);

        // Filter out obviously bad ones (e.g. headers treated as transactions)
        const validTransactions = transactions.filter(t => {
            // "Inicio Mercado pago" usually sets balance, ignore?
            // "Fecha Concepto"
            if (t.description.toLowerCase().includes('fecha') && t.description.toLowerCase().includes('concepto')) return false;
            // Ignore Start Balance
            if (t.description.includes('Inicio') && t.description.includes('Mercado pago')) return false;
            return true;
        });

        console.log(`Valid transactions: ${validTransactions.length}`);

        fs.writeFileSync('transactions.json', JSON.stringify(validTransactions, null, 2));
        console.log('Saved to transactions.json');

        if (parser.destroy) await parser.destroy();

    } catch (e) {
        console.error('Error:', e);
    }
}

parse();
