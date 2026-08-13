# Restaurant Order Manager (React + Supabase)

Real multi-device restaurant ordering system with:

- **Customer public ordering page** (`/order`)
- **Staff login** with roles: admin, manager, waiter, kitchen
- **Realtime sync** – orders appear instantly on all devices
- Dashboard, Menu management, Take Order, Active Orders, History

---

## 1. Create a free Supabase project

1. Go to [https://supabase.com](https://supabase.com) → New Project
2. Choose a name, database password, and region
3. Wait until the project is ready

---

## 2. Run the database schema

1. In Supabase Dashboard → **SQL Editor** → New query
2. Copy the entire contents of `supabase/schema.sql`
3. Paste and click **Run**

This creates tables, security policies, sample menu, and the profile trigger.

---

## 3. Enable Realtime

1. Go to **Database → Replication** (or **Publications**)
2. Enable replication for these tables:
   - `orders`
   - `order_items`
   - `menu_items`

(Or run the commented `ALTER PUBLICATION` lines in the schema if available on your plan.)

---

## 4. Create staff users

1. Go to **Authentication → Users → Add user**
2. Create users with email + password
3. After creating each user, go to **Table Editor → profiles** and set the correct `role`:
   - `admin`
   - `manager`
   - `waiter`
   - `kitchen`

Alternatively you can sign up via the app later and then change the role in the `profiles` table.

---

## 5. Get your API keys

1. Go to **Project Settings → API**
2. Copy:
   - Project URL
   - `anon` `public` key

---

## 6. Configure the React app

```bash
cd restaurant-app
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

---

## 7. Install & run

```bash
npm install
npm run dev
```

Open the URL shown (usually http://localhost:5173)

- Customer page: http://localhost:5173/order
- Staff login:   http://localhost:5173/login

---

## 8. Test multi-device sync

1. Open `/order` on your phone (same Wi-Fi or deployed)
2. Place an order for a table
3. Open `/staff` (logged in as kitchen or waiter) on another device
4. The order should appear **instantly** in Active Orders

---

## Project structure

```
src/
  components/     (shared UI if needed)
  context/        AuthContext.jsx
  lib/            supabase.js
  pages/
    Login.jsx
    StaffLayout.jsx
    Dashboard.jsx
    MenuManagement.jsx
    TakeOrder.jsx
    ActiveOrders.jsx
    OrderHistory.jsx
    CustomerOrder.jsx
  App.jsx
  main.jsx
supabase/
  schema.sql
```

---

## Roles & permissions (simple version)

| Role     | Menu | Take Order | Active Orders | History | Dashboard |
|----------|------|------------|---------------|---------|-----------|
| admin    | ✓    | ✓          | ✓             | ✓       | ✓         |
| manager  | ✓    | ✓          | ✓             | ✓       | ✓         |
| waiter   | –    | ✓          | ✓             | ✓       | ✓         |
| kitchen  | –    | –          | ✓ (status)    | –       | ✓         |
| customer | –    | public page only | –        | –       | –         |

---

## Deploy later

You can deploy the frontend to **Vercel**, **Netlify**, or **Cloudflare Pages**.  
Just set the same two environment variables in the hosting dashboard.
