'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { InventoryItem, POJob } from '@/lib/types';
import { itemTitle } from '@/lib/util';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const officeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135789.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function poDivIcon(count: number, isReference: boolean): L.DivIcon {
  const bg = isReference ? '#06b6d4' : count > 0 ? '#10b981' : '#52525b';
  const ring = isReference ? '#67e8f9' : count > 0 ? '#6ee7b7' : '#a1a1aa';
  const label = isReference ? '★' : count > 0 ? String(count) : '·';
  return L.divIcon({
    className: 'insultrack-po-pin',
    html: `<div style="
      background:${bg};
      width:36px;height:36px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      border:3px solid ${ring};
      box-shadow:0 4px 10px rgba(0,0,0,0.45);
      color:#fff;font-weight:700;font-size:14px;
      font-family:system-ui,-apple-system,sans-serif;">${label}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

interface POBucket {
  po: POJob;
  items: InventoryItem[];
}

interface MapComponentProps {
  buckets: POBucket[];
  referencePO?: POJob;
  onSelectItem: (item: InventoryItem) => void;
}

const mainOffice = {
  lat: 51.088,
  lng: -114.012,
  name: 'Adler Construction Services',
  address: '3800 19 St NE, Calgary, AB',
};

export default function MapComponent({ buckets, referencePO, onSelectItem }: MapComponentProps) {
  const center: [number, number] = referencePO
    ? [referencePO.latitude, referencePO.longitude]
    : [mainOffice.lat, mainOffice.lng];

  const refPoint: [number, number] | null = referencePO
    ? [referencePO.latitude, referencePO.longitude]
    : null;

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Marker position={[mainOffice.lat, mainOffice.lng]} icon={officeIcon}>
        <Popup>
          <div style={{ color: '#000' }}>
            <div style={{ fontWeight: 600, color: '#2563eb' }}>{mainOffice.name}</div>
            <div style={{ fontSize: 12 }}>{mainOffice.address}</div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>Main Office</div>
          </div>
        </Popup>
      </Marker>

      {buckets.map(({ po, items }) => {
        const isRef = !!referencePO && po.id === referencePO.id;
        return (
          <React.Fragment key={po.id}>
            <Marker
              position={[po.latitude, po.longitude]}
              icon={poDivIcon(items.length, isRef)}
            >
              <Popup>
                <div style={{ color: '#000', minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{po.poNumber}</div>
                  <div style={{ fontSize: 11, color: '#52525b' }}>{po.address}</div>
                  {isRef && (
                    <div style={{ fontSize: 11, color: '#0891b2', marginTop: 4, fontWeight: 600 }}>
                      ★ Your assigned site
                    </div>
                  )}
                  {items.length > 0 ? (
                    <div style={{ marginTop: 8, borderTop: '1px solid #e4e4e7', paddingTop: 8 }}>
                      <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        {items.length} available
                      </div>
                      {items.map((i) => (
                        <button
                          key={i.id}
                          onClick={() => onSelectItem(i)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            padding: '6px 8px',
                            marginTop: 4,
                            borderRadius: 6,
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{i.quantity} {i.unit}</div>
                          <div>{itemTitle(i)}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#a1a1aa', fontStyle: 'italic' }}>
                      No material available here right now.
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>

            {refPoint && !isRef && items.length > 0 && (
              <Polyline
                positions={[refPoint, [po.latitude, po.longitude]]}
                pathOptions={{ color: '#10b981', weight: 1.5, opacity: 0.35, dashArray: '5, 8' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
