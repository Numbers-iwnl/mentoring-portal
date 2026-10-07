# mentoring-portal

**A management portal for a business-mentoring program for clinic owners.** It replaced a workflow built on shared spreadsheets: each mentee records sales, leads and costs; the mentoring team follows every clinic from an admin dashboard with goals, filters, exports and an audit trail.

> 🇧🇷 Portal de acompanhamento para uma mentoria de donos de clínica: vendas, captação de contatos, custo por hora, metas e auditoria — substituindo planilhas compartilhadas. Interface em português.

## What it does

**For mentees (and their staff)**
- **Sales** with up to two payment methods, installments and first-receipt date; the form previews the **estimated cash flow month by month** before saving. Refunds (partial or total) are tracked and shown on the dashboard by the date they happened.
- **Leads / messages**: origin, whether it was scheduled, follow-up status and a separate *lead status* (approach, answered, discarded with reason, booked treatment).
- **Cost per hour** of the clinic: monthly expenses + room hours → cost per hour, with a fixed idle-time allowance.
- **Dashboard** with monthly gross sales, payment methods, sales by area and by specialty, weekly views and alerts for entries that don't add up.
- **Team**: register professionals and specialties, create staff logins with per-screen permissions (staff can edit but not delete or export), up to five extra admins, multiple clinic areas.
- **Spreadsheet import**: anyone who used the standard spreadsheet before the portal can upload it; re-importing the same file never duplicates entries.
- **Excel exports** and an **AI assistant** that explains every screen.

**For the mentoring team (admin)**
- Global dashboard with **monthly goals**, all mentees' sales and leads with the same filters plus *mentee* and *area*, per-mentee management, imports on a mentee's behalf, editable form lists, and an **audit log** of who changed what.

## How it's built

- **Next.js 14 (App Router) + TypeScript**, server actions for mutations, **Prisma + MySQL** (11 models).
- **NextAuth (credentials)** with roles (admin, mentee, staff), forced password change on first login, and **password reset by e-mail** (one-hour tokens; the flow disables itself gracefully when SMTP isn't configured).
- **Zod** validation shared by forms and actions; **Tailwind** UI; **Recharts** dashboards; **ExcelJS** import/export.
- **Filters as data**: list filters, pagination and multi-select options are pure functions in `lib/`, so the same filter panel works for mentees and admins and is unit-tested.
- **AI assistant** (`app/api/assistant`): a chat endpoint that only answers authenticated users, adapts to the user's role, has a per-user daily limit, and uses a system prompt (`lib/assistant-prompt.ts`) that documents the portal screen by screen. It never sees user data and refuses clinical advice.

```
app/app/        mentee area (dashboard, sales, messages, costs, team, imports, history)
app/admin/      admin area (dashboard, students, finance, messages, costs, imports, audit, settings)
lib/            domain logic: payments, period math, filters, clinic costs, imports, permissions
tests/          61 Vitest tests (payments, periods, filters, pagination, clinic costs, dashboard…)
```

## Run it locally

```bash
pnpm install
cp .env.example .env        # MySQL URL, NextAuth secret, first admin
pnpm prisma:dev && pnpm db:seed
pnpm dev
```

Quality gate used before every deploy:

```bash
pnpm qa     # typecheck + tests + production build
```

## Stack

Next.js 14 · TypeScript · Prisma · MySQL · NextAuth · Zod · Tailwind CSS · Recharts · ExcelJS · Vitest · OpenAI API

---

Built by [João Barbosa](https://joaobarbosa.pages.dev) at his employer and published here **with the employer's permission**. The brand ("Aurora Mentoring" is fictional), logos, business figures, internal training material and all client data were removed.

**© João Barbosa. All rights reserved.** No open-source license is granted — you're welcome to read the code, but please don't reuse it without permission.
