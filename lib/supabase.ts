import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Khusus ticketing — services database (terpisah)
export const supabaseServices = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY!
);
