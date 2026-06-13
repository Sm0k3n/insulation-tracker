'use client';

import React from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';

interface Material {
  id: string;
  poNumber: string;
  material: string;
  size?: string;
  thickness?: string;
  quantity: number;
  unit: string;
  address: string;
  distance: number;
}

interface GoogleMapComponentProps {
  materials: Material[];
  onSelect: (material: Material) => void;
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 51.088,
  lng: -114.012
};

export default function GoogleMapComponent({ materials, onSelect }: GoogleMapComponentProps) {
  const [selected, setSelected] = React.useState<Material | null>(null);

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={11}
      >
        {/* Main Office */}
        <Marker
          position={{ lat: 51.088, lng: -114.012 }}
          label="A"
          onClick={() => alert('Adler Construction Services\n3800 19 St NE, Calgary')}
        />

        {/* Job Sites */}
        {materials.map((item) => {
          // Simple coordinate assignment based on PO#
          const lat = item.poNumber === 'WinSport' ? 51.078 : 
                     item.poNumber === 'Stampede Park' ? 51.038 : 
                     item.poNumber === 'Bow Tower' ? 51.045 : 51.05;
          const lng = item.poNumber === 'WinSport' ? -114.215 : 
                     item.poNumber === 'Stampede Park' ? -114.054 : 
                     item.poNumber === 'Bow Tower' ? -114.065 : -114.07;

          return (
            <Marker
              key={item.id}
              position={{ lat, lng }}
              onClick={() => {
                setSelected(item);
                onSelect(item);
              }}
            />
          );
        })}

        {selected && (
          <InfoWindow
            position={{ lat: 51.05, lng: -114.07 }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="text-black">
              <div className="font-semibold">{selected.poNumber}</div>
              <div>{selected.size} × {selected.thickness}</div>
              <div className="text-emerald-600">{selected.quantity} {selected.unit} available</div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
}
