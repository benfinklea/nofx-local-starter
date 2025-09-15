import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = (URL && KEY)
  ? createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : ({
      storage: {
        from() { return { createSignedUrl: async () => ({ data: null, error: new Error('supabase disabled') }) };
        },
        // optional helper present in some versions
        createBucket: async () => ({ data: null, error: new Error('supabase disabled') })
      }
    } as any);

export const ARTIFACT_BUCKET = process.env.SUPABASE_BUCKET || "artifacts";
