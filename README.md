# Maha Duck

Customer ordering and staff dashboard built on Next.js App Router and React.

## Run locally

1. Install dependencies with `npm install`.
2. Start the Next.js development server with `npm run dev`.
3. Open `http://localhost:3000` for customer ordering or `http://localhost:3000/admin` for staff.

Use `npm run build` to create a production build and `npm run start` to serve it. `npm run check` validates the existing browser controllers. `npm run dev:legacy` starts the previous static preview on port 4173 for comparison.

## Features

- Customer ordering for delivery, pickup, and dine-in, with menu customization, PromptPay, and order tracking.
- Staff dashboard with cashier and kitchen views, delivery handoff, POS, receipts, and table QR codes.
- Burmese, Thai, and English interfaces.

## Project layout

```text
app/                 Next.js routes and React page boundary
app/page.jsx         Customer route
app/admin/page.jsx   Staff dashboard route
dist/                Existing menu, settings, visual assets, and browser controllers
docs/                Setup instructions
scripts/             Optional legacy static server
supabase/            Database schema and policies
```

During the route migration, the React pages render the existing page structure and load the existing browser controllers in order to preserve all ordering and POS workflows. The controllers and source markup in `dist/` remain the compatibility layer while those interactions are migrated to React components.

Shop settings and menu data remain in `dist/settings/config.js` and `dist/settings/menu.js`. Supabase setup instructions are in `docs/SETUP-GUIDE-MY.md`.
