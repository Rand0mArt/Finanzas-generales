import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Parse amounts, removing parenthesis as negatives
const parseAmount = (valStr) => {
    if (!valStr || String(valStr).trim() === '') return 0;
    let s = String(valStr).replace(/,/g, '').trim();
    if (s.startsWith('(') && s.endsWith(')')) {
        return -parseFloat(s.substring(1, s.length - 1));
    }
    return parseFloat(s);
};

// Define the data from the images
const data = {
    "Hogar": {
        budget: 20000,
        type: "personal",
        emoji: "🏠",
        transactions: [
            { date: "2024-02-13", desc: "Frutas y verduras", amount: "(515)", category: "Comida" },
            { date: "2024-02-13", desc: "Garrafón y pan Meraz", amount: "(81)", category: "Comida" },
            { date: "2024-02-13", desc: "Queso y tocino", amount: "(380)", category: "Comida" },
            { date: "2024-02-13", desc: "Pollo, huesos, carne puerco, chuletas", amount: "307", category: "Comida" },
            { date: "2024-02-15", desc: "Cena en Lázaro", amount: "(650)", category: "Personal" },
            { date: "2024-02-17", desc: "Gasolina", amount: "(1500)", category: "Transporte" },
            { date: "2024-02-19", desc: "Doña silvia", amount: "(300)", category: "Limpieza" },
            { date: "2024-02-19", desc: "Comida china", amount: "(445)", category: "Comida" },
            { date: "2024-02-19", desc: "Deuda BBVA", amount: "(4345)", category: "Deuda" },
            { date: "2024-02-20", desc: "Tacos el infierno", amount: "(600)", category: "Comida" },
            { date: "2024-02-20", desc: "Huevos y hotcakes", amount: "(186)", category: "Comida" },
            { date: "2024-02-20", desc: "Liquidación Notario", amount: "(17000)", category: "Deuda" },
            { date: "2024-02-20", desc: "Tortillas", amount: "(31)", category: "Comida" },
            { date: "2024-02-21", desc: "Nieve y atole", amount: "(100)", category: "Comida" },
            { date: "2024-02-21", desc: "Palitos para rasurar", amount: "(30)", category: "Personal" },
            { date: "2024-02-21", desc: "Pulque del gordito", amount: "(60)", category: "Comida" },
            // Image 2 (Hogar continues)
            { date: "2024-02-05", desc: "Vinagre blanco", amount: "(15)", category: "Comida" },
            { date: "2024-02-06", desc: "Bolillos", amount: "(25)", category: "Comida" },
            { date: "2024-02-06", desc: "Chicharrón", amount: "(60)", category: "Comida" },
            { date: "2024-02-06", desc: "Garrafón y pan", amount: "(67)", category: "Comida" },
            { date: "2024-02-06", desc: "Café 1/4", amount: "(75)", category: "Comida" },
            { date: "2024-02-06", desc: "Chocolate Diana", amount: "(20)", category: "Comida" },
            { date: "2024-02-07", desc: "Tacos Wich", amount: "(270)", category: "Comida" },
            { date: "2024-02-07", desc: "Pastel chino", amount: "(230)", category: "Personal" },
            { date: "2024-02-08", desc: "Pizza", amount: "(420)", category: "Comida" },
            { date: "2024-02-08", desc: "Disney y vix", amount: "(200)", category: "Personal" },
            { date: "2024-02-09", desc: "TikTok Diana", amount: "(611)", category: "Personal" },
            { date: "2024-02-09", desc: "Recarga Diana", amount: "(50)", category: "Servicios" },
            { date: "2024-02-09", desc: "Pollo", amount: "(300)", category: "Comida" },
            { date: "2024-02-09", desc: "Pan Bimbo", amount: "(40)", category: "Comida" },
            { date: "2024-02-09", desc: "Despensa sams", amount: "(822)", category: "Comida" },
            { date: "2024-02-09", desc: "Rollos de papel sams", amount: "(250)", category: "Limpieza" },
            { date: "2024-02-09", desc: "Aceite de litro", amount: "(85)", category: "Transporte" },
            { date: "2024-02-09", desc: "Pasta de dientes", amount: "(95)", category: "Limpieza" },
            { date: "2024-02-09", desc: "Toallas bebe", amount: "(15)", category: "Limpieza" },
            { date: "2024-02-09", desc: "Despensa Walmart", amount: "(1284)", category: "Comida" },
            { date: "2024-02-10", desc: "Jitomate y cebolla", amount: "(17)", category: "Comida" },
            { date: "2024-02-10", desc: "Despensa 3b", amount: "(133)", category: "Comida" },
            { date: "2024-02-10", desc: "Toallas eco", amount: "(20)", category: "Limpieza" },
            { date: "2024-02-10", desc: "Despensa merza", amount: "(240)", category: "Comida" },
            { date: "2024-02-11", desc: "Basura", amount: "(20)", category: "Limpieza" },
            { date: "2024-02-12", desc: "Dra. examen estructural", amount: "(2000)", category: "Bebé" },
            { date: "2024-02-12", desc: "Pinzanes", amount: "(50)", category: "Comida" },
            { date: "2024-02-12", desc: "Nieve macdonals", amount: "(50)", category: "Comida" },
            { date: "2024-02-12", desc: "Bistec y tortillas", amount: "(100)", category: "Comida" },
            // Image 3 (Hogar continues)
            { date: "2024-02-01", desc: "Renta", amount: "(4000)", category: "Renta" },
            { date: "2024-02-10", desc: "Internet", amount: "(519)", category: "Servicios" },
            { date: "2024-02-01", desc: "Audible", amount: "0", category: "Servicios" },
            { date: "2024-02-09", desc: "Ginecóloga", amount: "(800)", category: "Bebé" },
            { date: "2024-02-01", desc: "Costal Gatty y perro Sam's", amount: "(761)", category: "Mascotas" },
            { date: "2024-02-01", desc: "Mercado, bolillos, chiles, limones", amount: "(80)", category: "Comida" },
            { date: "2024-02-01", desc: "Torta", amount: "(80)", category: "Comida" },
            { date: "2024-02-02", desc: "Miches Carne azada abuelito", amount: "(120)", category: "Personal" },
            { date: "2024-02-02", desc: "Toallas eco", amount: "(20)", category: "Limpieza" },
            { date: "2024-02-02", desc: "Juguete chulo rosca y arena de gato 3", amount: "(105)", category: "Mascotas" },
            { date: "2024-02-02", desc: "Despensa 3b", amount: "(131)", category: "Comida" },
            { date: "2024-02-03", desc: "Basura", amount: "(20)", category: "Limpieza" },
            { date: "2024-02-03", desc: "Tortillas", amount: "(20)", category: "Comida" },
            { date: "2024-02-03", desc: "Salsa de soya, 1 l", amount: "(40)", category: "Comida" },
            { date: "2024-02-03", desc: "Vinagre balsámico", amount: "(30)", category: "Comida" },
            { date: "2024-02-03", desc: "Salsa de anguila", amount: "(25)", category: "Comida" },
            { date: "2024-02-03", desc: "Boing de mango", amount: "(33)", category: "Comida" },
            { date: "2024-02-03", desc: "Arroz, inflado", amount: "(20)", category: "Comida" },
            { date: "2024-02-03", desc: "Maruchan y frijoles", amount: "(75)", category: "Comida" },
            { date: "2024-02-04", desc: "Doña silvia", amount: "(300)", category: "Limpieza" },
            { date: "2024-02-05", desc: "Monchos Burguer", amount: "(410)", category: "Personal" },
            { date: "2024-02-05", desc: "Despensa la comercial", amount: "(260)", category: "Comida" },
            { date: "2024-02-05", desc: "Deuda Alberto (merch)", amount: "(7486)", category: "Deuda" },
            { date: "2024-02-05", desc: "Deuda Alberto (escritura)", amount: "(30000)", category: "Deuda" },
            { date: "2024-02-05", desc: "Deuda Alberto (notario)", amount: "(20000)", category: "Deuda" },
            { date: "2024-02-05", desc: "BBVA crédito", amount: "(1000)", category: "Deuda" },
            { date: "2024-02-05", desc: "Lavado camioneta", amount: "(160)", category: "Transporte" },
        ]
    },
    "Dhash": {
        budget: 4500,
        type: "business",
        emoji: "💼",
        transactions: [
            // Image 2
            { date: "2024-02-09", desc: "Esponja", amount: "(15)", category: "Materiales" },
            { date: "2024-02-10", desc: "Rodin web", amount: "(3920)", category: "Materiales" },
            { date: "2024-02-10", desc: "Anticipo Angeles covarubias", amount: "18000", category: "Murales (Ingreso)" },
            { date: "2024-02-10", desc: "Comisión Randm", amount: "(5250)", category: "Gastos operativos" },
            { date: "2024-02-10", desc: "Materiales Temu", amount: "(1025)", category: "Materiales" },
            { date: "2024-02-10", desc: "Rollo de papel para enmascarar", amount: "(1500)", category: "Materiales" },
            { date: "2024-02-10", desc: "Pako", amount: "(2500)", category: "Sueldos" },
            { date: "2024-02-11", desc: "Liquidación (los bañados)", amount: "2500", category: "Diseño (Ingreso)" },
            { date: "2024-02-17", desc: "Polifoam 10m", amount: "(200)", category: "Materiales" },
            { date: "2024-02-17", desc: "Liquidación Contemple", amount: "35000", category: "Cuadros (Ingreso)" },
            { date: "2024-02-19", desc: "Papel craf", amount: "(400)", category: "Materiales" },
            { date: "2024-02-20", desc: "Sobre e impresión", amount: "(13)", category: "Materiales" },
            { date: "2024-02-20", desc: "Brocha para barniz", amount: "0", category: "Materiales" },
            // Image 3 (Dhash continues)
            { date: "2024-02-06", desc: "Dhash web $333", amount: "0", category: "Gastos operativos" },
            { date: "2024-02-06", desc: "iCloud", amount: "(17)", category: "Gastos operativos" },
            { date: "2024-02-24", desc: "Instagram verified", amount: "(215)", category: "Gastos operativos" },
            { date: "2024-02-26", desc: "YouTube Premium", amount: "(209)", category: "Gastos operativos" },
            { date: "2024-02-02", desc: "Aceite de canola", amount: "(29)", category: "Materiales" },
            { date: "2024-02-03", desc: "Stencil y Taxi, Loera", amount: "(150)", category: "Materiales" },
            { date: "2024-02-03", desc: "Liquidación (Bosque rojo)", amount: "11000", category: "Cuadros (Ingreso)" },
            { date: "2024-02-03", desc: "Impresiónes", amount: "(33)", category: "Materiales" },
            { date: "2024-02-03", desc: "Lacre rojo", amount: "(84)", category: "Materiales" },
            { date: "2024-02-03", desc: "Redondeadora", amount: "(139)", category: "Materiales" },
            { date: "2024-02-03", desc: "Hilo Yute 100m", amount: "(127)", category: "Materiales" },
            { date: "2024-02-03", desc: "Esponja para pintar", amount: "(60)", category: "Materiales" },
            { date: "2024-02-03", desc: "3 m de yute", amount: "(8)", category: "Materiales" },
            { date: "2024-02-03", desc: "Cuerda de papel", amount: "(15)", category: "Materiales" },
            { date: "2024-02-03", desc: "Cinta transparente", amount: "(25)", category: "Materiales" },
            { date: "2024-02-03", desc: "Espagueti espuma", amount: "(40)", category: "Materiales" },
            { date: "2024-02-04", desc: "Saldo", amount: "(150)", category: "Gastos operativos" },
            { date: "2024-02-05", desc: "Liquidación (agua)", amount: "10000", category: "Cuadros (Ingreso)" },
            { date: "2024-02-05", desc: "Mitad cuadro Alberto", amount: "(5000)", category: "Gastos operativos" },
            { date: "2024-02-05", desc: "3 espagueti espuma", amount: "(120)", category: "Materiales" },
            { date: "2024-02-05", desc: "Impresiones", amount: "(15)", category: "Materiales" },
            { date: "2024-02-05", desc: "Polifom 2mm 20x3m", amount: "(400)", category: "Materiales" },
            { date: "2024-02-07", desc: "Préstamo Loera", amount: "(1000)", category: "Sueldos" },
            { date: "2024-02-09", desc: "Cinta paquetes", amount: "(55)", category: "Materiales" },
        ]
    },
    "RNDM": {
        budget: 3900,
        type: "business",
        emoji: "🎨",
        transactions: [
            // Image 3 (RNDM)
            { date: "2023-09-08", desc: "Cap cut", amount: "(250)", category: "Subscripciones" },
            { date: "2024-02-01", desc: "Renta", amount: "(2000)", category: "Servicios" },
            { date: "2024-02-01", desc: "Nan", amount: "(400)", category: "Contabilidad" },
            { date: "2024-02-01", desc: "Internet", amount: "(400)", category: "Servicios" },
            { date: "2024-02-01", desc: "Saldo", amount: "(150)", category: "Servicios" },
            { date: "2024-02-10", desc: "Canva", amount: "(1250)", category: "Subscripciones" },
            { date: "2024-02-12", desc: "Gemini Google", amount: "(130)", category: "Subscripciones" },
            { date: "2024-02-10", desc: "Comisión Angeles (Dhash)", amount: "5250", category: "Comisiones (Ingreso)" },
            { date: "2024-02-13", desc: "Google", amount: "(129)", category: "Subscripciones" },
            { date: "2024-02-15", desc: "Venta Expo cubano", amount: "0", category: "Ventas (Ingreso)" },
            { date: "2024-02-15", desc: "VPS Hostinger", amount: "(192)", category: "Subscripciones" },
            { date: "2024-02-15", desc: "Créditos DeepSeek", amount: "(91)", category: "Subscripciones" },
            { date: "2024-02-16", desc: "Rótulo los Bañados", amount: "700", category: "Comisiones (Ingreso)" },
            { date: "2024-02-19", desc: "Créditos Deepseek", amount: "(200)", category: "Subscripciones" },
            { date: "2024-02-20", desc: "Prestamo don Sergio", amount: "(700)", category: "Servicios" },
        ]
    }
};

async function run() {
    console.log("Connecting to Supabase...");

    console.log("Cleaning database...");
    await supabase.from('transactions').delete().neq('amount', -99999999);
    await supabase.from('categories').delete().neq('type', 'invalid_type');
    await supabase.from('wallets').delete().neq('name', 'invalid_wallet___');

    console.log("Inserting new dataset...");
    for (const [walletName, wData] of Object.entries(data)) {
        // Insert Wallet
        const { data: newWallet, error: insWErr } = await supabase.from('wallets').insert({
            name: walletName,
            emoji: wData.emoji,
            wallet_type: wData.type,
            monthly_budget: wData.budget
        }).select().single();

        if (insWErr) {
            console.error("Error inserting wallet " + walletName, insWErr);
            continue;
        }

        // Buscamos o creamos las categorías requeridas
        const { data: categories } = await supabase.from('categories').select('*').eq('wallet_id', newWallet.id);
        let catsMap = {};
        if (categories) {
            categories.forEach(c => catsMap[c.name.toLowerCase()] = c.id);
        }

        // Add Initial Balance as an income transaction
        let initialCatId = catsMap["saldo inicial"];
        if (!initialCatId) {
            const { data: newCat } = await supabase.from('categories').insert({
                wallet_id: newWallet.id, name: "Saldo Inicial", type: "income", icon: "💰"
            }).select().single();
            if (newCat) { initialCatId = newCat.id; catsMap["saldo inicial"] = initialCatId; }
        }

        await supabase.from('transactions').insert({
            wallet_id: newWallet.id,
            category_id: initialCatId,
            type: "income",
            amount: wData.budget,
            date: "2024-02-01",
            description: "Saldo inicial reportado"
        });

        // Insert Transactions
        const txToInsert = [];
        for (const t of wData.transactions) {
            let amt = parseAmount(t.amount);
            const isIncome = amt > 0 || (t.category && t.category.includes("(Ingreso)"));
            const finalAmt = Math.abs(amt);
            let catName = t.category.replace(" (Ingreso)", "").trim();

            let catId = catsMap[catName.toLowerCase()];
            if (!catId) {
                const { data: newCat } = await supabase.from('categories').insert({
                    wallet_id: newWallet.id, name: catName, type: isIncome ? 'income' : 'expense', icon: "🏷️"
                }).select().single();
                if (newCat) { catId = newCat.id; catsMap[catName.toLowerCase()] = catId; }
            }

            txToInsert.push({
                wallet_id: newWallet.id,
                category_id: catId,
                type: isIncome ? 'income' : 'expense',
                amount: finalAmt,
                date: t.date,
                description: t.desc
            });
        }

        // Bulk insert
        if (txToInsert.length > 0) {
            for (let i = 0; i < txToInsert.length; i += 20) {
                const chunk = txToInsert.slice(i, i + 20);
                const { error: errTx } = await supabase.from('transactions').insert(chunk);
                if (errTx) console.error("Error inserting TX chunk for " + walletName, errTx);
            }
        }

        console.log(`Inserted ${txToInsert.length} tx for ${walletName}`);
    }

    console.log("Migration complete.");
}

run();
