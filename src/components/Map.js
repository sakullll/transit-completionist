import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import '../styles/Map.css';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function Map({ transitData }) {
  const [map, setMap] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeLayers, setRouteLayers] = useState({});

  // Initialize map
  useEffect(() => {
    if (!transitData) return;

    const mapInstance = L.map('map').setView([47.6, -122.33], 11);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, [transitData]);

  // Draw routes
  useEffect(() => {
    if (!map || !transitData || !transitData.routes) return;

    const newRouteLayers = {};

    transitData.routes.forEach((route) => {
      if (!route.stops || route.stops.length === 0) return;

      // Create polyline for this route
      const coordinates = route.stops
        .map((stopId) => transitData.stops[stopId])
        .filter((stop) => stop && stop.lat && stop.lng)
        .map((stop) => [stop.lat, stop.lng]);

      if (coordinates.length > 1) {
        const polyline = L.polyline(coordinates, {
          color: route.color || '#999999',
          weight: 3,
          opacity: 0.6,
          smoothFactor: 1.0,
          lineCap: 'round',
          lineJoin: 'round',
        });

        // Make route clickable
        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedRoute(route);
          polyline.setStyle({ opacity: 1, weight: 5 });
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        });

        // Add hover effect
        polyline.on('mouseover', () => {
          polyline.setStyle({ weight: 4, opacity: 0.8 });
        });

        polyline.on('mouseout', () => {
          if (selectedRoute?.id !== route.id) {
            polyline.setStyle({ weight: 3, opacity: 0.6 });
          }
        });

        polyline.addTo(map);
        newRouteLayers[route.id] = polyline;
      }
    });

    setRouteLayers(newRouteLayers);

    return () => {
      Object.values(newRouteLayers).forEach((layer) => {
        map.removeLayer(layer);
      });
    };
  }, [map, transitData]);

  // Update styling when selection changes
  useEffect(() => {
    if (!transitData?.routes) return;

    transitData.routes.forEach((route) => {
      const layer = routeLayers[route.id];
      if (layer) {
        if (selectedRoute?.id === route.id) {
          layer.setStyle({ opacity: 1, weight: 5 });
        } else {
          layer.setStyle({ opacity: 0.6, weight: 3 });
        }
      }
    });
  }, [selectedRoute, routeLayers, transitData]);

  return (
    <div className="map-container">
      <div id="map" className="map"></div>
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
