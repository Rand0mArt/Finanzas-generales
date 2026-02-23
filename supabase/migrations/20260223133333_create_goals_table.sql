-- ==========================================
-- Finanzas Generales V2.1: Goals Table Setup
-- ==========================================

-- 1. Create the `goals` table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    wallet_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL DEFAULT 0,
    current_amount NUMERIC NOT NULL DEFAULT 0,
    category_type TEXT DEFAULT 'Ahorro',
    deadline DATE,
    status TEXT DEFAULT 'active',
    icon TEXT DEFAULT '🎯',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add Row Level Security (RLS) policies
-- Allowing anonymous access if your other tables also use anonymous access.
-- If you use authentication, adjust the policies accordingly.

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (matching typical public starter setups for your app)
CREATE POLICY "Allow anon select goals" ON public.goals FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert goals" ON public.goals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update goals" ON public.goals FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete goals" ON public.goals FOR DELETE TO anon USING (true);

-- Allow all operations for authenticated users
CREATE POLICY "Allow auth select goals" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update goals" ON public.goals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow auth delete goals" ON public.goals FOR DELETE TO authenticated USING (true);
