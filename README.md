# CLOSERPAY — Payment Link Generator & Sales Analytics Dashboard

A full-stack Next.js application for generating custom Whop checkout links and tracking sales performance. Built for high-ticket sales teams using Whop as their payment processor.

## Features

- **Payment Link Generator** — Create one-time, recurring, and split-pay checkout links via Whop
- **Closer Attribution** — Every payment is automatically attributed to the correct closer
- **Real-time Analytics** — Revenue charts, closer leaderboards, and product breakdowns
- **Webhook Processing** — Automatic payment tracking via Whop webhooks with idempotency
- **Zapier Integration** — Outbound webhook on payment success with delivery tracking and manual retry
- **Commission Tracking** — Per-closer commission calculations (percentage or flat rate)
- **CSV Export** — Export payment data for reporting

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS 4 with custom futuristic dark theme
- **Database:** PostgreSQL (Neon) via Prisma 7
- **Payments:** Whop SDK (`@whop/sdk`)
- **Charts:** Recharts
- **UI:** Radix UI primitives, Lucide icons
- **Fonts:** Orbitron, JetBrains Mono, Inter

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string (Neon)
- `WHOP_API_KEY` — Your Whop Company API key
- `WHOP_COMPANY_ID` — Your Whop Company ID (biz_xxx)
- `NEXT_PUBLIC_APP_URL` — Your deployment URL

### 3. Push database schema

```bash
npx prisma db push
```

### 4. Run development server

```bash
npm run dev
```

### 5. Setup Webhook

After deploying, go to Settings and click "Register Webhook" to start receiving payment events from Whop.

## Deployment (Vercel)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. The build command already includes `prisma generate`
5. After first deploy, update `NEXT_PUBLIC_APP_URL` and register the webhook

## Project Structure

```
app/                    # Next.js App Router pages + API routes
├── api/                # REST API endpoints
│   ├── closers/        # CRUD for sales closers
│   ├── products/       # Proxy to Whop products API
│   ├── payment-links/  # Generate & manage payment links
│   ├── payments/       # Payment records + CSV export
│   ├── webhooks/       # Whop webhook handler + registration
│   └── analytics/      # Dashboard data endpoints
├── generate/           # Payment link generator page
├── links/              # Payment links list
├── payments/           # Payments log
├── closers/            # Closer leaderboard
└── settings/           # App settings + webhook config
components/             # React components
├── ui/                 # Reusable UI primitives
├── layout/             # Sidebar + TopBar
├── dashboard/          # Dashboard charts + stats
└── generate/           # Link generator components
lib/                    # Shared utilities
prisma/                 # Database schema
```
