# poly-crm

Read-only P&L dashboard for the Polymarket 5-minute bot. Shows **settled** live windows only. Does not talk to the CLOB or place orders.

Held one-sided windows are re-settled from [Polymarket Gamma](https://gamma-api.polymarket.com) (`outcomePrices` snapped to ~0/1). A stale TWAP on Railway cannot turn a winning $20 Up fill into a −$20 CRM row. Exits and balanced pairs are left as the bot wrote them.

Deploy on [Vercel](https://vercel.com): **Add New Project → Import `chay0354/poly-crm`**. Framework: Next.js.

## Environment (Vercel → Settings → Environment Variables)

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://duuozrmornbeburedfsd.supabase.co` | Same project the bot writes to |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | Server only. Same key as Railway. **Never** `NEXT_PUBLIC_` |

Do **not** add `PM_PRIVATE_KEY`. This app reads `windows` / `fills` and may rewrite `up_won` / `estimated_pnl` / `result` when Gamma disagrees with the bot.

## Local

```bash
cp .env.example .env.local
# paste the secret key
npm install
npm run dev
```

Open http://localhost:3000
