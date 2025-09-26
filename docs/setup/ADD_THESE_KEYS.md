# Add These Environment Variables to Vercel

## Go to: https://vercel.com/volacci/nofx-control-plane/settings/environment-variables

### 1. Supabase Keys (REQUIRED)
Get these from: https://supabase.com/dashboard/project/pacxtzdgbzwzdyjebzgp/settings/api

- **SUPABASE_ANON_KEY** = (copy the `anon` public key from Supabase dashboard)
- **SUPABASE_SERVICE_ROLE_KEY** = (copy the `service_role` secret key from Supabase dashboard)

### 2. AI API Keys (Add what you have)
- **OPENAI_API_KEY** = (your OpenAI API key if you have one)
- **ANTHROPIC_API_KEY** = (your Anthropic API key if you have one)

After adding these, your deployment will work!