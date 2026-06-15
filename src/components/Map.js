import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/Map.css';

function Map({ transitData }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    if (!transitData || !mapContainer.current || map.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView([47.6, -122.33], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Draw all routes
    const routeLayers = {};

    transitData.routes.forEach((route) => {
      if (!route.stops || route.stops.length === 0) return;

      // Get coordinates for this route
      const coordinates = route.stops
        .map((stopId) => transitData.stops[stopId])
        .filter((stop) => stop && stop.lat && stop.lng)
        .map((stop) => [parseFloat(stop.lat), parseFloat(stop.lng)]);

      if (coordinates.length > 1) {
        const polyline = L.polyline(coordinates, {
          color: route.color || '#999999',
          weight: 3,
          opacity: 0.6,
        });

        polyline.on('click', () => {
          setSelectedRoute(route);
        });

        polyline.on('mouseover', () => {
          polyline.setStyle({ weight: 5, opacity: 0.9 });
        });

        polyline.on('mouseout', () => {
          if (selectedRoute?.id !== route.id) {
            polyline.setStyle({ weight: 3, opacity: 0.6 });
          }
        });

        polyline.addTo(map.current);
        routeLayers[route.id] = polyline;
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [transitData, selectedRoute]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map-container"></div>
      {selectedRoute && (
        <div className="route-panel">
          <button
            className="close-btn"
            onClick={() => setSelectedRoute(null)}
          >
            ✕
          </button>
          <h3>{selectedRoute.shortName || 'Route'}</h3>
          <p className="route-name">{selectedRoute.longName}</p>
          <div
            className="route-color"
            style={{ backgroundColor: selectedRoute.color || '#999999' }}
          ></div>
          <p className="stops-count">{selectedRoute.stops?.length || 0} stops</p>
        </div>
      )}
    </div>
  );
}

export default Map;
