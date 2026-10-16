import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Complaint } from "@/types";
import { statusLabel } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

interface Props {
  complaints: Complaint[];
  height?: string;
}

const DISTRICT_COORDS: Record<string, [number, number]> = {
  "Chennai": [13.0827, 80.2707],
  "Mumbai": [19.076, 72.8777],
  "Delhi": [28.7041, 77.1025],
  "Bangalore": [12.9716, 77.5946],
  "Kolkata": [22.5726, 88.3639],
  "Hyderabad": [17.385, 78.4867],
  "Pune": [18.5204, 73.8567],
  "Ahmedabad": [23.0225, 72.5714],
  "Jaipur": [26.9124, 75.7873],
  "Lucknow": [26.8467, 80.9462],
  "Patna": [25.6093, 85.1376],
  "Bhopal": [23.2599, 77.4126],
  "Thiruvananthapuram": [8.5241, 76.9366],
  "Guwahati": [26.1445, 91.7362],
  "Chandigarh": [30.7333, 76.7794],
  "Dehradun": [30.3165, 78.0322],
  "Raipur": [21.2514, 81.6296],
  "Ranchi": [23.3441, 85.3096],
  "Shimla": [31.1048, 77.1734],
  "Imphal": [24.8170, 93.9368],
  "Aizawl": [23.7271, 92.7176],
  "Kohima": [25.6586, 94.1086],
  "Itanagar": [27.1044, 93.6920],
  "Gangtok": [27.3389, 88.6065],
  "Panaji": [15.4909, 73.8278],
  "Varanasi": [25.3176, 82.9739],
  "Nagpur": [21.1458, 79.0882],
  "Indore": [22.7196, 75.8577],
  "Coimbatore": [11.0168, 76.9558],
  "Madurai": [9.9252, 78.1198],
  "Visakhapatnam": [17.6868, 83.2185],
  "Surat": [21.1702, 72.8311],
  "Vadodara": [22.3072, 73.1812],
  "Rajkot": [22.3039, 70.8022],
  "Amritsar": [31.6340, 74.8723],
  "Jodhpur": [26.2389, 73.0243],
  "Udaipur": [24.5854, 73.7125],
  "Gwalior": [26.2183, 78.1828],
  "Agra": [27.1767, 78.0081],
  "Meerut": [28.9845, 77.7064],
  "Noida": [28.5355, 77.3910],
  "Ghaziabad": [28.6692, 77.4538],
  "Faridabad": [28.4089, 77.3178],
  "Thane": [19.2183, 72.9781],
  "Navi Mumbai": [19.0330, 73.0297],
  "Nashik": [19.9975, 73.7898],
  "Aurangabad": [19.8762, 75.3433],
};

// Fallback for locations without exact coordinates - use India center with random spread
function getLocationCoords(complaint: Complaint): [number, number] | null {
  // Try district first, then location name
  const coords = DISTRICT_COORDS[complaint.district] || DISTRICT_COORDS[complaint.location];
  if (coords) return coords;

  // Try partial match
  const allKeys = Object.keys(DISTRICT_COORDS);
  const match = allKeys.find(k =>
    complaint.district.toLowerCase().includes(k.toLowerCase()) ||
    complaint.location.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(complaint.district.toLowerCase())
  );
  if (match) return DISTRICT_COORDS[match];

  // Fallback: spread around India center
  return [20.5937 + (Math.random() - 0.5) * 8, 78.9629 + (Math.random() - 0.5) * 8];
}

export default function ComplaintMap({ complaints, height = "400px" }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!mapRef.current || complaints.length === 0) return;

    import("leaflet").then((L) => {
      if (!mapRef.current) return;

      // Destroy previous map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      const bounds: [number, number][] = [];
      const priorityColors: Record<string, string> = {
        critical: "#ef4444",
        high: "#f97316",
        medium: "#eab308",
        low: "#22c55e",
      };

      complaints.forEach((c) => {
        const coords = getLocationCoords(c);
        if (!coords) return;

        const lat = coords[0] + (Math.random() - 0.5) * 0.03;
        const lng = coords[1] + (Math.random() - 0.5) * 0.03;
        bounds.push([lat, lng]);

        const color = priorityColors[c.priority] || "#6b7280";

        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        }).addTo(map);

        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui;font-size:13px;padding:4px">
            <strong style="color:#1a365d;font-size:14px">${c.petitionId}</strong><br/>
            <span style="font-weight:600;display:block;margin:4px 0">${c.title}</span>
            <span style="color:#666;display:block;margin-bottom:6px">${c.category}</span>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color}20;color:${color};font-weight:600;font-size:11px">${c.priority.toUpperCase()}</span>
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#f0f5ff;color:#1a365d;font-weight:600;font-size:11px">${statusLabel(c.status)}</span>
            </div>
            <div style="margin-top:6px;font-size:11px;color:#888">
              📍 ${c.location}, ${c.district}
            </div>
          </div>
        `);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }

      // Fix map rendering
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [complaints]);

  return (
    <div className="card-base overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Complaint Locations</h3>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Critical</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>High</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>Medium</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>Low</span>
        </div>
      </div>
      <div ref={mapRef} style={{ height, width: "100%", zIndex: 0 }} className="leaflet-container" />
    </div>
  );
}
