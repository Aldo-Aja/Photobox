import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Database features will be disabled.');
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  layout_type: 'grid' | 'vertical' | 'mosaic';
  slots: number;
  config: any;
}

export interface Photostrip {
  id: string;
  template_id: string;
  photos: string[]; // Array of base64 or URLs
  created_at: string;
  event_name?: string;
}
