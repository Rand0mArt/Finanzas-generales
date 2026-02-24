import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
    const { error } = await supabase.from('transactions').delete().gt('amount', -999999999);
    if (error) {
        console.error("Error wiping DB:", error);
    } else {
        console.log("DB WIPED SUCCESSFULLY! All transactions have been cleared.");
    }
}
wipe();
