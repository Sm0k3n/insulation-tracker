import type { InventoryItem, POJob, Transaction, User } from './types';

const now = () => new Date().toISOString();
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

// 4 real Calgary jobsites with real-ish lat/lng + the Airdrie warehouse.
export const seedPOs: POJob[] = [
  {
    id: 'po-warehouse-airdrie',
    poNumber: 'WH-AIRDRIE',
    address: 'Airdrie, AB (Main Warehouse)',
    latitude: 51.2917,
    longitude: -114.0144,
    type: 'warehouse',
    status: 'Active',
    notes: 'Main material warehouse — drivers add stock here and dispatch to jobsites',
    createdAt: ago(60 * 24 * 365),
  },
  {
    id: 'po-winsport',
    poNumber: 'WinSport',
    address: '88 Canada Olympic Rd SW, Calgary, AB',
    latitude: 51.0822,
    longitude: -114.2150,
    foremanId: '2',
    contactName: 'Alex Rivera',
    contactPhone: '403-555-0123',
    status: 'Active',
    notes: 'Arena chiller line replacement',
    createdAt: ago(60 * 24 * 8),
  },
  {
    id: 'po-stampede',
    poNumber: 'Stampede Park',
    address: '1410 Olympic Way SE, Calgary, AB',
    latitude: 51.0383,
    longitude: -114.0561,
    foremanId: '3',
    contactName: 'Mike Torres',
    contactPhone: '403-555-0155',
    status: 'Active',
    notes: 'Saddledome HVAC retrofit',
    createdAt: ago(60 * 24 * 14),
  },
  {
    id: 'po-bow',
    poNumber: 'Bow Tower',
    address: '500 Centre St SE, Calgary, AB',
    latitude: 51.0492,
    longitude: -114.0660,
    contactName: 'James Patel',
    contactPhone: '403-555-0177',
    status: 'Active',
    notes: 'Mechanical room riser insulation',
    createdAt: ago(60 * 24 * 4),
  },
  {
    id: 'po-mcmahon',
    poNumber: 'McMahon Stadium',
    address: '1817 Crowchild Trail NW, Calgary, AB',
    latitude: 51.0700,
    longitude: -114.1212,
    contactName: 'Sarah Chen',
    contactPhone: '403-555-0166',
    status: 'Active',
    notes: 'Concourse domestic water lines',
    createdAt: ago(60 * 24 * 2),
  },
];

export const seedUsers: User[] = [
  { id: '1', name: 'Brent Barkman', role: 'Admin',           email: 'brent.r.barkman@gmail.com', phone: '' },
  { id: '2', name: 'Alex Rivera',   role: 'Foreman',         email: 'alex@insultrac.com',        phone: '403-555-0123', assignedPO: 'WinSport' },
  { id: '3', name: 'Mike Torres',   role: 'Foreman',         email: 'mike@insultrac.com',        phone: '403-555-0155', assignedPO: 'Stampede Park' },
  { id: '4', name: 'Jordan Hale',   role: 'Delivery Driver', email: 'jordan@insultrac.com',      phone: '403-555-0188' },
  { id: '5', name: 'Sam Patel',     role: 'Employee',        email: 'sam@insultrac.com',         phone: '403-555-0144' },
];

// Realistic spread across categories + statuses
export const seedInventory: InventoryItem[] = [
  // WinSport
  {
    id: 'i1', poNumber: 'WinSport', category: 'Pipe Insulation', status: 'Available for Pickup',
    quantity: 45, unit: 'pcs', updatedAt: ago(20), updatedBy: 'Alex Rivera',
    specs: { materialType: 'Fiberglass', pipeSize: '2"', insulationThickness: '2"', length: '3 ft', jacketType: 'ASJ', manufacturer: 'Owens Corning' },
  },
  {
    id: 'i2', poNumber: 'WinSport', category: 'Pipe Insulation', status: 'Needed on Site',
    quantity: 22, unit: 'pcs', updatedAt: ago(120), updatedBy: 'Alex Rivera',
    specs: { materialType: 'Foamglass', pipeSize: '3"', insulationThickness: '1.5"', length: '2 ft', jacketType: 'ASJ' },
  },
  {
    id: 'i3', poNumber: 'WinSport', category: 'Fitting Cover', status: 'Available for Pickup',
    quantity: 16, unit: 'pcs', updatedAt: ago(45), updatedBy: 'Alex Rivera',
    specs: { fittingType: 'PVC 90', pipeSize: '2"', insulationThickness: '2"' },
  },
  {
    id: 'i4', poNumber: 'WinSport', category: 'Consumable', status: 'Available for Pickup',
    quantity: 6, unit: 'rolls', updatedAt: ago(180), updatedBy: 'Alex Rivera',
    specs: { productName: 'ASJ Tape 3"', manufacturer: 'Venture' },
  },

  // Stampede Park
  {
    id: 'i5', poNumber: 'Stampede Park', category: 'Pipe Insulation', status: 'Available for Pickup',
    quantity: 30, unit: 'pcs', updatedAt: ago(30), updatedBy: 'Mike Torres',
    specs: { materialType: 'Fiberglass', pipeSize: '2"', insulationThickness: '2"', length: '3 ft', jacketType: 'ASJ' },
  },
  {
    id: 'i6', poNumber: 'Stampede Park', category: 'Pipe Insulation', status: 'Needed on Site',
    quantity: 18, unit: 'pcs', updatedAt: ago(15), updatedBy: 'Mike Torres',
    specs: { materialType: 'Mineral Wool', pipeSize: '4"', insulationThickness: '3"', length: '3 ft' },
  },
  {
    id: 'i7', poNumber: 'Stampede Park', category: 'Jacketing', status: 'Available for Pickup',
    quantity: 8, unit: 'rolls', updatedAt: ago(50), updatedBy: 'Mike Torres',
    specs: { materialType: 'Aluminum Jacketing', gauge: '0.016"', width: '36"', length: '50 ft' },
  },
  {
    id: 'i8', poNumber: 'Stampede Park', category: 'Equipment', status: 'Needed on Site',
    quantity: 1, unit: 'units', updatedAt: ago(720), updatedBy: 'Mike Torres',
    specs: { productName: 'Baker Scaffold (6 ft)', serial: 'BS-2104' },
  },

  // Bow Tower
  {
    id: 'i9', poNumber: 'Bow Tower', category: 'Pipe Insulation', status: 'Available for Pickup',
    quantity: 55, unit: 'pcs', updatedAt: ago(10), updatedBy: 'James Patel',
    specs: { materialType: 'Fiberglass', pipeSize: '2"', insulationThickness: '2"', length: '3 ft', jacketType: 'ASJ' },
  },
  {
    id: 'i10', poNumber: 'Bow Tower', category: 'Duct Wrap', status: 'Available for Pickup',
    quantity: 3, unit: 'rolls', updatedAt: ago(95), updatedBy: 'James Patel',
    specs: { insulationThickness: '1.5"', width: '48"', length: '75 ft', facingType: 'FSK' },
  },
  {
    id: 'i11', poNumber: 'Bow Tower', category: 'Fitting Cover', status: 'Reserved',
    quantity: 12, unit: 'pcs', updatedAt: ago(8), updatedBy: 'James Patel', reservedBy: 'Sam Patel',
    specs: { fittingType: 'PVC Tee', pipeSize: '3"', insulationThickness: '1.5"' },
  },

  // McMahon Stadium
  {
    id: 'i12', poNumber: 'McMahon Stadium', category: 'Pipe Insulation', status: 'Available for Pickup',
    quantity: 40, unit: 'pcs', updatedAt: ago(25), updatedBy: 'Sarah Chen',
    specs: { materialType: 'Armaflex', pipeSize: '1.5"', insulationThickness: '1"', length: '6 ft' },
  },
  {
    id: 'i13', poNumber: 'McMahon Stadium', category: 'Consumable', status: 'Needed on Site',
    quantity: 4, unit: 'tubes', updatedAt: ago(75), updatedBy: 'Sarah Chen',
    specs: { productName: 'Armaflex Adhesive 520', manufacturer: 'Armacell' },
  },
  {
    id: 'i14', poNumber: 'McMahon Stadium', category: 'Pipe Insulation', status: 'Damaged',
    quantity: 7, unit: 'pcs', updatedAt: ago(160), updatedBy: 'Sarah Chen', notes: 'Water damage on bottom row of pallet',
    specs: { materialType: 'Fiberglass', pipeSize: '4"', insulationThickness: '2"', length: '3 ft' },
  },

  // WH-AIRDRIE warehouse stock (driver-managed; ready to dispatch to jobsites)
  {
    id: 'i-wh1', poNumber: 'WH-AIRDRIE', category: 'Pipe Insulation', status: 'Available for Pickup',
    quantity: 180, unit: 'pcs', updatedAt: ago(60 * 6), updatedBy: 'Jordan Hale',
    specs: { materialType: 'Fiberglass', pipeSize: '2"', insulationThickness: '2"', length: '3 ft', jacketType: 'ASJ', manufacturer: 'Owens Corning' },
  },
  {
    id: 'i-wh2', poNumber: 'WH-AIRDRIE', category: 'Pipe Insulation', status: 'Available for Pickup',
    quantity: 95, unit: 'pcs', updatedAt: ago(60 * 24 * 2), updatedBy: 'Jordan Hale',
    specs: { materialType: 'Fiberglass', pipeSize: '4"', insulationThickness: '2"', length: '3 ft', jacketType: 'ASJ', manufacturer: 'Owens Corning' },
  },
  {
    id: 'i-wh3', poNumber: 'WH-AIRDRIE', category: 'Jacketing', status: 'Available for Pickup',
    quantity: 22, unit: 'rolls', updatedAt: ago(60 * 18), updatedBy: 'Jordan Hale',
    specs: { materialType: 'Aluminum Jacketing', gauge: '0.016"', width: '36"', length: '50 ft' },
  },
  {
    id: 'i-wh4', poNumber: 'WH-AIRDRIE', category: 'Consumable', status: 'Available for Pickup',
    quantity: 48, unit: 'rolls', updatedAt: ago(60 * 30), updatedBy: 'Jordan Hale',
    specs: { productName: 'ASJ Tape 3"', manufacturer: 'Venture' },
  },
  {
    id: 'i-wh5', poNumber: 'WH-AIRDRIE', category: 'Fitting Cover', status: 'Available for Pickup',
    quantity: 60, unit: 'pcs', updatedAt: ago(60 * 48), updatedBy: 'Jordan Hale',
    specs: { fittingType: 'PVC 90', pipeSize: '2"', insulationThickness: '2"' },
  },
];

export const seedTransactions: Transaction[] = [
  {
    id: 't1', poNumber: 'WinSport', itemId: 'i1', user: 'Alex Rivera',
    timestamp: ago(20), action: 'marked-available',
    materialSummary: '2" IPS × 2" Fiberglass (45 pcs)', quantity: 45,
    fromStatus: 'Needed on Site', toStatus: 'Available for Pickup',
  },
  {
    id: 't2', poNumber: 'Bow Tower', itemId: 'i11', user: 'Sam Patel',
    timestamp: ago(8), action: 'reserved',
    materialSummary: 'PVC Tee 3" × 1.5" (12 pcs)', quantity: 12,
    fromStatus: 'Available for Pickup', toStatus: 'Reserved',
    notes: 'Need for Friday install at WinSport',
  },
  {
    id: 't3', poNumber: 'McMahon Stadium', itemId: 'i14', user: 'Sarah Chen',
    timestamp: ago(160), action: 'marked-damaged',
    materialSummary: '4" IPS × 2" Fiberglass (7 pcs)', quantity: 7,
    fromStatus: 'Needed on Site', toStatus: 'Damaged',
    notes: 'Water damage on bottom row of pallet',
  },
];
