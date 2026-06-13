# InsulTrack SaaS Plan — Multi-Tenant Version

**Goal:** Turn the current prototype into a real subscription product.
- Adler (original insulation company) gets the product **free forever**
- Other companies (plumbers, general contractors, etc.) pay a monthly subscription
- Clean tenant isolation so no company can ever see another company's data

---

## 1. High-Level Architecture

**Stack**
- **Frontend**: Next.js 16 (App Router) — already in use
- **Auth**: Supabase Auth (or Clerk) — handles users + companies
- **Database**: Supabase Postgres with Row Level Security (RLS)
- **Billing**: Stripe (Subscriptions + Customer Portal)
- **Hosting**: Vercel
- **File Storage** (if needed later): Supabase Storage

**Multi-Tenancy Model**
- Every company = one `Organization`
- Every user belongs to exactly one `Organization`
- All data tables have an `organization_id` column
- Row Level Security policies enforce isolation at the database level

---

## 2. Core Data Model

```sql
-- Core tables
organizations (
  id uuid primary key,
  name text,
  slug text unique,           -- used in URLs (adler, acme-plumbing, etc.)
  plan text,                  -- 'free' | 'starter' | 'pro' | 'enterprise'
  stripe_customer_id text,
  created_at timestamptz
)

users (
  id uuid primary key,
  organization_id uuid references organizations,
  email text,
  full_name text,
  role text,                  -- 'owner' | 'admin' | 'foreman' | 'warehouse'
  created_at timestamptz
)

-- Domain tables (all have organization_id)
purchase_orders (
  id uuid,
  organization_id uuid,
  po_number text,
  job_name text,
  status text,
  ...
)

inventory_items (
  id uuid,
  organization_id uuid,
  po_id uuid,
  material text,
  size text,
  thickness text,
  quantity integer,
  status text,
  ...
)

transfers, material_orders, daily_reports, etc. — all include organization_id
```

**Row Level Security Example**
```sql
-- Users can only see data from their own organization
CREATE POLICY "Users can only access their org data"
ON inventory_items
FOR ALL
USING (organization_id = auth.jwt() ->> 'organization_id');
```

---

## 3. Subscription & Billing Flow

**Plans (initial)**
| Plan        | Price     | Users | Jobs | Features                     | Target          |
|-------------|-----------|-------|------|------------------------------|-----------------|
| Free        | $0        | ∞     | ∞    | Core features                | Adler only      |
| Starter     | $99/mo    | 5     | 10   | Basic reporting              | Small contractors |
| Pro         | $249/mo   | ∞     | ∞    | Advanced reports, map, API   | Growing companies |
| Enterprise  | Custom    | ∞     | ∞    | SSO, white-label, SLA        | Large contractors |

**Stripe Integration**
- New organization signs up → create Stripe customer + subscription
- Webhook listener updates `organizations.plan` when payment succeeds/fails
- Self-serve upgrade/downgrade via Stripe Customer Portal

---

## 4. User & Organization Onboarding

1. User signs up with email
2. Creates new organization (or joins via invite)
3. Stripe checkout (unless it's the Adler free org)
4. Redirected into their workspace

**Adler Special Case**
- Hardcoded organization slug `adler` or `organization_id` that bypasses Stripe
- Or we manually mark it as `plan = 'free'` in the database

---

## 5. Security & Isolation

- **Database**: RLS on every table
- **API**: Every query filtered by `organization_id` from JWT
- **Frontend**: UI only shows data belonging to the logged-in user's org
- **Admin**: Only Adler owners can see the global "Organizations" list

---

## 6. Roadmap (SaaS Version)

**Phase 1 — Foundation**
- Add `organizations` + `organization_id` to all tables
- Supabase Auth + RLS policies
- Basic login + organization switching (for Adler admins)

**Phase 2 — Billing**
- Stripe integration + subscription checkout
- Plan enforcement (limit jobs/users based on plan)
- Billing settings page

**Phase 3 — Polish**
- Organization settings (logo, name, users)
- Invite team members
- Usage dashboard (jobs created this month, etc.)

**Phase 4 — Growth**
- Public marketing site
- Pricing page
- Self-serve signup
- Email notifications (trial ending, payment failed, etc.)

---

## 7. Open Questions

- Do you want to support multiple users per organization from day one?
- Should the Free plan be publicly available or strictly Adler-only?
- Any must-have features for the paid plans (API access, white-label, etc.)?

---

**Next Action**

If this direction looks good, I can start implementing:

1. Create the `organizations` table + migration
2. Update the data model in the prototype
3. Add Supabase auth scaffolding

Just say the word.