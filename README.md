# poly-crm

Read-only P&L dashboard for the Polymarket 5-minute bot. Shows **settled** live windows only. Does not talk to the CLOB or place orders.

Deploy on [Vercel](https://vercel.com): **Add New Project → Import `chay0354/poly-crm`**. Framework: Next.js.

## Environment (Vercel → Settings → Environment Variables)

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://duuozrmornbeburedfsd.supabase.co` | Same project the bot writes to |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | Server only. Same key as Railway. **Never** `NEXT_PUBLIC_` |

Do **not** add `PM_PRIVATE_KEY`. This app only reads `windows` and `fills`.

## Local

```bash
cp .env.example .env.local
# paste the secret key
npm install
npm run dev
```

Open http://localhost:3000
