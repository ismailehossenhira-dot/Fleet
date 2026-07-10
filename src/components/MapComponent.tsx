import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    label: string;
    type?: 'vehicle' | 'destination';
  }>;
  route?: Array<[number, number]>;
  className?: string;
  onClick?: (latlng: L.LatLng) => void;
}

const MapEvents = ({ onClick }: { onClick?: (latlng: L.LatLng) => void }) => {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    map.on('click', (e) => {
      onClick(e.latlng);
    });
    return () => {
      map.off('click');
    };
  }, [map, onClick]);
  return null;
};

const MapComponent: React.FC<MapProps> = ({ 
  center = [23.8103, 90.4125], // Default: Dhaka
  zoom = 7, 
  markers = [], 
  route = [], 
  className = "h-[400px] w-full rounded-xl overflow-hidden shadow-inner",
  onClick
}) => {
  return (
    <div className={className}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker, idx) => (
          <Marker key={idx} position={marker.position}>
            <Popup>
              <div className="text-xs font-bold">{marker.label}</div>
            </Popup>
          </Marker>
        ))}
        {route.length > 0 && (
          <Polyline positions={route} color="blue" weight={4} opacity={0.6} dashArray="10, 10" />
        )}
        <MapEvents onClick={onClick} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;
