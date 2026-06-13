# InsulTrack Prototype Plan

**Goal:** Turn the existing component set into a complete, usable field prototype for mechanical insulation operations.

**Tech**
- Next.js 16 + Turbopack
- Tailwind 4
- Map: Mapbox (primary) + fallback Leaflet
- All state in main page + localStorage persistence
- Mobile-first, bottom nav, dark zinc theme

## Core Features to Implement

### Phase 1: Foundation (Current)
- [x] Fix page.tsx shell + activeTab state
- [x] Clear .next cache + running dev server
- [ ] Add localStorage persistence for inventory + transfers + reports

### Phase 2: Data & State
- Realistic seed data for 4 POs (WinSport, Stampede Park, Bow Tower, McMahon Stadium)
- InventoryItem type fully defined and shared
- User context (Foreman vs Warehouse role)
- All components receive and mutate the same inventory state

### Phase 3: Main Screens Polish

**PO Jobs (jobs tab)**
- List of active POs with last activity
- Tap PO → shows job detail + assigned inventory
- Quick status toggle from job view
- Add new PO form (simple)

**Inventory (inventory tab)**
- Table/grid of all items
- Filter by PO or status
- Status toggle only allowed for assigned PO when role=Foreman
- Search

**Transfers**
- Create transfer requests between POs
- Approve/complete transfers (moves inventory)
- List of pending + completed

**Material Orders**
- Submit material orders against a PO
- Status workflow (Submitted → Approved → Delivered)

**Daily Reports**
- Log daily material usage per PO
- Simple form + history list

**Map (map tab)**
- CityMap showing PO locations in Calgary area
- Click marker → shows PO + quick inventory summary
- Use Mapbox if token present, else Leaflet fallback

**Admin**
- Simple user list + role assignment
- PO → Foreman assignments

### Phase 4: UX & Polish
- Top header with user + role switcher (for demo)
- Loading / empty states
- Toast notifications for actions (success, transfer complete, etc.)
- Responsive and thumb-friendly
- Consistent emerald accent + zinc dark theme

### Phase 5: Extras (if time)
- Fake "sync" button
- Offline banner simulation
- Export reports as CSV

## Data Model

```ts
interface InventoryItem {
  id: string;
  poNumber: string;
  material: string;
  size?: string;
  thickness?: string;
  quantity: number;
  unit: string;
  status: 'Available for Pickup' | 'On Site' | 'Used';
}

interface POJob { ... }
interface Transfer { ... }
interface Order { ... }
interface ReportEntry { ... }
```

## Execution Approach

I'll implement this in logical chunks, updating the running app after each major piece. You'll see changes live on localhost:3000.

Start with persistence + seed data, then systematically improve each tab.