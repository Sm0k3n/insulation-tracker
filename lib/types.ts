// Roles per spec — Warehouse intentionally removed.
export type Role = 'Admin' | 'Delivery Driver' | 'Foreman' | 'Employee';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone: string;
  assignedPO?: string;
}

// All 9 inventory statuses per spec. Only "Available for Pickup" shows on the City Map.
export const INVENTORY_STATUSES = [
  'Needed on Site',
  'Available for Pickup',
  'Reserved',
  'Transfer Requested',
  'Picked Up',
  'Delivered to New PO#',
  'Used',
  'Damaged',
  'Missing',
] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

// Material categories per spec.
export const MATERIAL_CATEGORIES = [
  'Pipe Insulation',
  'Fitting Cover',
  'Duct Wrap',
  'Jacketing',
  'Consumable',
  'Equipment',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

// Single inventory shape. Per-category fields live in `specs` so we don't break
// existing components that read top-level `quantity/status/poNumber`.
export interface InventoryItem {
  id: string;
  poNumber: string;
  category: MaterialCategory;
  status: InventoryStatus;
  quantity: number;
  unit: string;
  notes?: string;
  updatedAt: string; // ISO
  updatedBy: string; // user name (cheap for proto)
  reservedBy?: string; // user name
  /** When reserved/picked-up, where it's headed. Empties after delivery completes. */
  destinationPO?: string;

  // Category-specific specs. All optional; meaningful subset depends on category.
  specs: {
    // Pipe Insulation
    materialType?: string;     // Fiberglass | Mineral Wool | Calcium Silicate | Elastomeric/Armaflex | Polyiso | Aluminum | Stainless | PVC | ASJ Tape | …
    manufacturer?: string;
    productLine?: string;
    pipeSize?: string;         // '2"'
    insulationThickness?: string; // '2"'
    length?: string;           // '3 ft'
    jacketType?: string;       // ASJ | FSK | None

    // Fitting Cover
    fittingType?: string;      // 90 | 45 | Tee | End Cap | Valve Cover

    // Duct Wrap
    width?: string;
    facingType?: string;       // FSK | Unfaced

    // Jacketing
    gauge?: string;            // 0.016"

    // Consumable / Equipment
    productName?: string;      // ASJ tape, Venture tape, Banding, Adhesive, Mastic, …
    serial?: string;
  };
}

export interface PhotoEntry {
  id: string;
  dataUrl: string;        // resized base64 image
  caption?: string;
  uploadedBy: string;
  uploadedAt: string;     // ISO
}

export interface POJob {
  id: string;
  poNumber: string;
  address: string;
  latitude: number;
  longitude: number;
  foremanId?: string;
  contactName?: string;
  contactPhone?: string;
  status: 'Active' | 'On Hold' | 'Completed';
  notes?: string;
  createdAt: string;
  photos?: PhotoEntry[];
}

// Every inventory mutation writes one of these.
export type TransactionAction =
  | 'added'
  | 'removed'
  | 'used'
  | 'transferred-out'
  | 'transferred-in'
  | 'reserved'
  | 'unreserved'
  | 'delivered'
  | 'marked-available'
  | 'marked-damaged'
  | 'marked-missing'
  | 'status-changed';

export interface Transaction {
  id: string;
  poNumber: string;
  itemId?: string;
  user: string;
  timestamp: string; // ISO
  action: TransactionAction;
  materialSummary: string;
  quantity?: number;
  fromStatus?: InventoryStatus;
  toStatus?: InventoryStatus;
  toPO?: string;
  notes?: string;
}

export interface Transfer {
  id: string;
  fromPO: string;
  toPO: string;
  materialSummary: string;
  itemId?: string;
  quantity: number;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  requestedBy: string;
  createdAt: string;
}

export type OrderStatus =
  | 'Submitted'
  | 'Approved'
  | 'Scheduled'
  | 'Accepted by Driver'
  | 'Loaded'
  | 'En Route'
  | 'Delivered'
  | 'Cancelled';

export interface MaterialOrder {
  id: string;
  poNumber: string;                // destination PO
  requestedBy: string;
  neededByDate: string;
  neededByTime?: string;
  priority: 'Low' | 'Normal' | 'High' | 'Critical';
  items: Array<{ summary: string; quantity: number; unit: string; category?: MaterialCategory }>;
  notes?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  status: OrderStatus;
  driverId?: string;
  driverName?: string;
  /** Driver-supplied estimated arrival (ISO datetime). Updated on Accept / En Route. */
  eta?: string;
  createdAt: string;
  /** If this order is a Path B transfer (Reserve → Request delivery from City Map), source PO + reserved item ids. */
  sourcePO?: string;
  sourceItemIds?: string[];
  /** Audit log of status changes. */
  history?: Array<{ status: OrderStatus; by: string; at: string }>;
}

export interface DailyReport {
  id: string;
  poNumber: string;
  date: string;
  submittedBy: string;
  workCompleted: string;
  materialsUsed: Array<{ summary: string; quantity: number; unit: string; itemId?: string }>;
  equipmentUsed?: string[];
  notes?: string;
  photos?: string[]; // base64 data URLs for the prototype
  submittedAt: string;
}
