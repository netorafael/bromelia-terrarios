import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_PUBLIC_SUPABASE_URL (ou VITE_SUPABASE_URL) e VITE_SUPABASE_ANON_KEY precisam estar configuradas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
