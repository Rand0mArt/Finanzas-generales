import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseDate(dayStr) {
    const day = dayStr.split('-')[0].padStart(2, '0');
    return `2026-01-${day}`;
}

const rawData = [
    // HOGAR
    { wallet: 'hogar', date: '2-ene', desc: 'Despensa', amount: -1000, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '2-ene', desc: 'Gasolina', amount: -500, type: 'expense', catName: 'Transporte', catIcon: '🚗' },
    { wallet: 'hogar', date: '2-ene', desc: 'Tortillas', amount: -25, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '2-ene', desc: 'Despensa merza y garrafón', amount: -132, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '3-ene', desc: 'Gas exterior', amount: -610, type: 'expense', catName: 'Servicios', catIcon: '💡' },
    { wallet: 'hogar', date: '3-ene', desc: 'Internet Telmex', amount: -520, type: 'expense', catName: 'Servicios', catIcon: '💡' },
    { wallet: 'hogar', date: '4-ene', desc: 'Crema', amount: -45, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '5-ene', desc: 'Renta', amount: -4000, type: 'expense', catName: 'Renta', catIcon: '🏠' },
    { wallet: 'hogar', date: '5-ene', desc: 'Camión', amount: -20, type: 'expense', catName: 'Transporte', catIcon: '🚗' },
    { wallet: 'hogar', date: '5-ene', desc: 'Té verde bicarbonato coco pan café', amount: -181, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '5-ene', desc: 'Crema Simibaby', amount: -75, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '6-ene', desc: 'Uber baby', amount: -50, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '6-ene', desc: 'Reyes magos nueces', amount: -165, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '6-ene', desc: 'Quesabirria', amount: -70, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '8-ene', desc: 'Pollo', amount: -200, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '8-ene', desc: 'Cita ginecóloga', amount: -700, type: 'expense', catName: 'Bebé', catIcon: '👶' },
    { wallet: 'hogar', date: '9-ene', desc: 'Bolillo', amount: -50, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '9-ene', desc: 'Medicina calcio fem', amount: -357, type: 'expense', catName: 'Salud', catIcon: '💊' },
    { wallet: 'hogar', date: '9-ene', desc: 'Navajas rasurar', amount: -70, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '9-ene', desc: 'Tenis reparación', amount: -100, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '10-ene', desc: 'Taxi', amount: -80, type: 'expense', catName: 'Transporte', catIcon: '🚗' },
    { wallet: 'hogar', date: '10-ene', desc: 'Reparación camioneta', amount: -4440, type: 'expense', catName: 'Transporte', catIcon: '🚗' },
    { wallet: 'hogar', date: '10-ene', desc: 'Costal Gatty y perro Sams', amount: -1589, type: 'expense', catName: 'Mascotas', catIcon: '🐾' },
    { wallet: 'hogar', date: '10-ene', desc: 'Papel higiénico y jabón', amount: -311, type: 'expense', catName: 'Mantenimiento', catIcon: '🧹' },
    { wallet: 'hogar', date: '10-ene', desc: 'Sams despensa', amount: -1522, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '10-ene', desc: 'Zote jabón', amount: -12, type: 'expense', catName: 'Mantenimiento', catIcon: '🧹' },
    { wallet: 'hogar', date: '10-ene', desc: 'Sobres animalitos', amount: -24, type: 'expense', catName: 'Mascotas', catIcon: '🐾' },
    { wallet: 'hogar', date: '10-ene', desc: 'Despensa merza', amount: -376, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '12-ene', desc: 'Hamburguesas con amigos', amount: -200, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '12-ene', desc: 'Sra Silvia', amount: -300, type: 'expense', catName: 'Mantenimiento', catIcon: '🧹' },
    { wallet: 'hogar', date: '12-ene', desc: 'Cumpleaños tía Irma', amount: -350, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '13-ene', desc: 'Recarga Diana', amount: -50, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '13-ene', desc: 'Merza agua y panes', amount: -100, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '14-ene', desc: 'Paletas con Andrea', amount: -60, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '14-ene', desc: 'Préstamo Uber Andrea', amount: -52, type: 'expense', catName: 'Transporte', catIcon: '🚗' },
    { wallet: 'hogar', date: '15-ene', desc: 'Jamón y Boing', amount: -95, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '17-ene', desc: 'Jenny y Froy', amount: -120, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '17-ene', desc: 'Uber', amount: -135, type: 'expense', catName: 'Transporte', catIcon: '🚗' },
    { wallet: 'hogar', date: '21-ene', desc: 'Sra Silvia', amount: -300, type: 'expense', catName: 'Mantenimiento', catIcon: '🧹' },
    { wallet: 'hogar', date: '21-ene', desc: 'Crepes', amount: -100, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '23-ene', desc: 'BBVA crédito', amount: -500, type: 'expense', catName: 'Servicios', catIcon: '💡' },
    { wallet: 'hogar', date: '24-ene', desc: 'Recarga Diana', amount: -100, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '25-ene', desc: 'Chavindeca', amount: -200, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '27-ene', desc: 'Bistec y chicharrón', amount: -220, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '27-ene', desc: 'Calcio baby', amount: -55, type: 'expense', catName: 'Salud', catIcon: '💊' },
    { wallet: 'hogar', date: '27-ene', desc: 'Tortillas', amount: -15, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '27-ene', desc: 'Tortillas harina', amount: -44, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '27-ene', desc: 'Garrafón', amount: -53, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '28-ene', desc: 'Despensa merza', amount: -406, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '28-ene', desc: 'Elote con Jenny', amount: -60, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '28-ene', desc: 'Doña Silvia', amount: -300, type: 'expense', catName: 'Mantenimiento', catIcon: '🧹' },
    { wallet: 'hogar', date: '29-ene', desc: 'Café la pérgola', amount: -50, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '30-ene', desc: 'Frijoles', amount: -38, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '30-ene', desc: 'Pollo', amount: -120, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '30-ene', desc: 'Mercado', amount: -390, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '30-ene', desc: 'Cremería Andrade', amount: -378, type: 'expense', catName: 'Comida', catIcon: '🍽️' },
    { wallet: 'hogar', date: '30-ene', desc: 'Aceites ricino romero baby', amount: -105, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '30-ene', desc: 'Pastel de Wich', amount: -250, type: 'expense', catName: 'Personal', catIcon: '🧑' },
    { wallet: 'hogar', date: '30-ene', desc: 'Duolingo', amount: -500, type: 'expense', catName: 'Suscripciones', catIcon: '📱' },
    { wallet: 'hogar', date: '30-ene', desc: 'Luz casa', amount: -217, type: 'expense', catName: 'Servicios', catIcon: '💡' },

    // RNDM
    { wallet: 'random', date: '2-ene', desc: 'Renta', amount: -2000, type: 'expense', catName: 'Renta', catIcon: '🏢' },
    { wallet: 'random', date: '3-ene', desc: 'MidJourney', amount: -208, type: 'expense', catName: 'Suscripciones', catIcon: '📱' },
    { wallet: 'random', date: '3-ene', desc: 'Telmex', amount: -389, type: 'expense', catName: 'Servicios Op.', catIcon: '⚡' },
    { wallet: 'random', date: '5-ene', desc: 'Saldo', amount: -100, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'random', date: '5-ene', desc: 'Pago nan', amount: -400, type: 'expense', catName: 'Contabilidad', catIcon: '📊' },
    { wallet: 'random', date: '11-ene', desc: 'Comisión diseño Dash', amount: 825, type: 'income', catName: 'Comisiones', catIcon: '🤝' },
    { wallet: 'random', date: '12-ene', desc: 'Gemini Pro', amount: -130, type: 'expense', catName: 'Suscripciones', catIcon: '📱' },
    { wallet: 'random', date: '13-ene', desc: 'Impresión RNDM', amount: 1100, type: 'income', catName: 'Ventas', catIcon: '📦' },
    { wallet: 'random', date: '14-ene', desc: 'Impresiones Medellín', amount: -400, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'random', date: '15-ene', desc: 'Envío Juan Eduardo', amount: -518, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'random', date: '28-ene', desc: 'Internet', amount: -389, type: 'expense', catName: 'Servicios Op.', catIcon: '⚡' },
    { wallet: 'random', date: '29-ene', desc: 'Calendario', amount: -28, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'random', date: '31-ene', desc: 'Ventas', amount: 715, type: 'income', catName: 'Ventas', catIcon: '📦' },

    // DASH
    { wallet: 'dhash', date: '2-ene', desc: '3 molduras pecho paloma', amount: -285, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '2-ene', desc: 'Chemo Sayer', amount: -65, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '2-ene', desc: '5 galones vidrio líquido', amount: -6245, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '2-ene', desc: 'Tinte madera abeto', amount: -60, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '3-ene', desc: 'Hologramas seguridad', amount: -680, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '4-ene', desc: 'Fuentes caligráficas', amount: -22, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '5-ene', desc: 'Cuadro Agua', amount: 20000, type: 'income', catName: 'Cuadros', catIcon: '🖼️' },
    { wallet: 'dhash', date: '7-ene', desc: 'Puro peki', amount: -270, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'dhash', date: '10-ene', desc: 'Paquete diseño negocio', amount: 2700, type: 'income', catName: 'Diseño', catIcon: '🎯' },
    { wallet: 'dhash', date: '11-ene', desc: 'Comisión diseño RNDM', amount: -825, type: 'expense', catName: 'Otros', catIcon: '📁' },
    { wallet: 'dhash', date: '13-ene', desc: 'Alberto Agua', amount: -10000, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'dhash', date: '13-ene', desc: 'Diseño Artify', amount: 4000, type: 'income', catName: 'Diseño', catIcon: '🎯' },
    { wallet: 'dhash', date: '13-ene', desc: 'Impresión Artify', amount: -1100, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '14-ene', desc: 'Préstamo Andamio RNDM', amount: -5400, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'dhash', date: '15-ene', desc: 'Saldo Dash', amount: -100, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'dhash', date: '15-ene', desc: 'Gastos operativos CFE', amount: -4500, type: 'expense', catName: 'Servicios', catIcon: '💡' },
    { wallet: 'dhash', date: '21-ene', desc: 'Sueldo Loera', amount: -2000, type: 'expense', catName: 'Sueldos', catIcon: '👥' },
    { wallet: 'dhash', date: '21-ene', desc: 'Saldo Dash', amount: -100, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'dhash', date: '24-ene', desc: 'Certificados Urhuapani', amount: -184, type: 'expense', catName: 'Materiales', catIcon: '🎨' },
    { wallet: 'dhash', date: '25-ene', desc: 'Sueldo Loera', amount: -3000, type: 'expense', catName: 'Sueldos', catIcon: '👥' },
    { wallet: 'dhash', date: '25-ene', desc: 'Liquidación Noche de Muertos', amount: 58000, type: 'income', catName: 'Cuadros', catIcon: '🖼️' },
    { wallet: 'dhash', date: '26-ene', desc: 'Comisión Toño', amount: -8000, type: 'expense', catName: 'Otros', catIcon: '📁' },
    { wallet: 'dhash', date: '27-ene', desc: 'Gasolina', amount: -1400, type: 'expense', catName: 'Gasolina', catIcon: '🚗' },
    { wallet: 'dhash', date: '29-ene', desc: 'Dominio web', amount: -333, type: 'expense', catName: 'Gastos Operativos', catIcon: '⚡' },
    { wallet: 'dhash', date: '30-ene', desc: 'Papelería Tony', amount: -100, type: 'expense', catName: 'Materiales', catIcon: '🎨' }
];

async function seed() {
    console.log('Seeding Database with accurate data...');

    // 1. Fetch wallets
    const { data: dbWallets, error: wErr } = await supabase.from('wallets').select('*');
    if (wErr) {
        console.error('Failed to fetch wallets', wErr);
        return;
    }

    const walletMap = {
        hogar: dbWallets.find(w => w.name.toLowerCase() === 'hogar')?.id,
        random: dbWallets.find(w => w.name.toLowerCase() === 'random')?.id,
        dhash: dbWallets.find(w => w.name.toLowerCase() === 'dhash')?.id
    };

    // 2. Fetch all categories
    const { data: catDb, error: catErr } = await supabase.from('categories').select('*');
    if (catErr) {
        console.error('Failed to fetch categories', catErr);
        return;
    }

    let currentCats = catDb || [];

    for (let record of rawData) {
        console.log(`Processing: ${record.desc}`);

        const dbWalletId = walletMap[record.wallet];
        if (!dbWalletId) {
            console.error(`- Wallet UUID not found for ${record.wallet}`);
            continue;
        }

        // Attempt to find exact matching category in Supabase
        let category = currentCats.find(c =>
            c.wallet_id === dbWalletId &&
            c.name.trim().toLowerCase() === record.catName.trim().toLowerCase() &&
            c.type === record.type
        );

        let categoryId = null;

        if (!category) {
            console.log(` - Creating missing category: ${record.catName} in wallet ${record.wallet}`);
            const { data: newCat, error: ncErr } = await supabase.from('categories').insert({
                wallet_id: dbWalletId,
                name: record.catName,
                icon: record.catIcon,
                type: record.type
            }).select().single();

            if (ncErr) {
                console.error('   > Failed to create category', ncErr);
                continue;
            } else {
                category = newCat;
                currentCats.push(newCat);
                categoryId = newCat.id;
            }
        } else {
            categoryId = category.id;
        }

        let accId = 'Mercado Pago (Hogar)';
        if (record.wallet === 'random') accId = 'Mercado Pago (Random)';
        if (record.wallet === 'dhash') accId = 'Mercado Pago (Dhash)';

        const tx = {
            wallet_id: dbWalletId,
            account: accId,
            type: record.type,
            amount: Math.abs(record.amount), // Always positive in DB
            description: record.desc,
            date: parseDate(record.date),
            category_id: categoryId,
            is_fixed: false,
            notes: 'Imported via accurate seed script'
        };

        const { error: txErr } = await supabase.from('transactions').insert(tx);
        if (txErr) {
            console.error(`- Failed to insert transaction: ${record.desc}`, txErr);
        } else {
            console.log(`- Inserted successfully: ${record.desc} (${record.amount})`);
        }
    }

    console.log('✅ Accurate Seeding completed perfectly.');
}

seed().catch(console.error);
