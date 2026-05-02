# Eviction Management

Standalone, jurisdiction-aware eviction workflow for small landlords. MVP: Georgia / Fulton County / Non-Payment grounds / written-lease residential SFR.

Architecture & domain spec: see the design doc this repo was bootstrapped from. Build order tracked in this README's milestones.

## Stack

- **Web:** Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **Workflow:** xstate FSM, rules-as-data in `jurisdiction_rules`
- **Deploy:** Vercel (free) · Supabase free tier
- **Docs:** react-pdf · Handlebars templates
- **Optional integrations (free tiers):** Groq (LLM), Resend (email), Lob test mode (mail), Stripe test mode (payments)

## Getting started

```bash
cp .env.example .env.local      # fill in Supabase keys
npm install
npm run dev
```

Open http://localhost:3000.

### Database

Run the migration and seed against your Supabase project:

```bash
# Either via Supabase CLI:
supabase link --project-ref uetwnmeguarcmbfmurkw
supabase db push

# Or via psql with DATABASE_URL set:
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed/01_ga_fulton_nonpayment.sql
```

Auth: email magic link is enabled by default in Supabase. Add the production URL to **Authentication → URL Configuration → Redirect URLs**:
- `https://your-vercel-url.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback`

## Repo layout

```
app/                     Next.js App Router
  (marketing)            landing page
  login/                 magic-link auth
  auth/callback/         OAuth code exchange
  dashboard/             logged-in shell
  cases/                 case console (forthcoming)
components/ui/           shadcn primitives
lib/
  supabase/              browser + server clients, middleware
  rules/                 jurisdictional rules engine
  workflow/              xstate FSM
supabase/
  migrations/            schema (RLS-enforced)
  seed/                  GA/Fulton/Non-Payment rules + GA Demand for Possession template
```

## Build milestones

- [x] **0** — Foundation: scaffold, schema, auth, GA/Fulton seed, dashboard shell
- [ ] **1** — Property/Lease/Tenant CRUD
- [ ] **2** — Intake wizard + jurisdiction resolver
- [ ] **3** — Notice composer + react-pdf render + Lob test-mode mail
- [ ] **4** — Case Console (status, next actions, timeline)
- [ ] **5** — Tenant portal (notice display + Stripe cure payment)
- [ ] **6** — Evidence vault
- [ ] **7** — Filing composer (manual upload, then Tyler API)
- [ ] **8** — Hearing / judgment / writ flow
- [ ] **9** — Attorney marketplace v1 (manual onboarding)
- [ ] **10** — Billing (Stripe: per-case + Pro subscription)
- [ ] **11** — AI assist (Groq, opt-in)

## Standalone posture

EMS owns properties, leases, tenants, and the rent ledger natively. A future
Property Management integration layer can replace those entities with imports
without changing the domain model.

## Disclaimers

This software automates document generation and workflow. It does not provide
legal advice and is not a substitute for an attorney. Templates ship with a
`seed (NOT attorney-reviewed)` sign-off — replace with attorney-reviewed copy
before production use.
