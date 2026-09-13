import React, { useMemo } from 'react';
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import '../styles/Map.css';

function FitMapToRoute({ route, bounds }) {
  const map = useMap();

  if (route && bounds && bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }

  return null;
}

function simplifyPath(points) {
  if (points.length <= 18) {
    return points;
  }

  const step = Math.ceil(points.length / 18);
  const simplified = [];

  for (let i = 0; i < points.length; i += step) {
    simplified.push(points[i]);
  }

  if (simplified[simplified.length - 1] !== points[points.length - 1]) {
    simplified.push(points[points.length - 1]);
  }

  return simplified;
}

function Map({
  transitData,
  selectedRouteId,
  onRouteSelect,
  visibleRouteIds,
  riddenStopsByRoute,
  onToggleStop,
  selectedDirection,
  onDirectionSelect,
  onCompleteEntireLine,
  onResetRoute,
}) {
  const routePolylines = useMemo(() => {
    if (!transitData?.routes) return [];

    return transitData.routes
      .map((route) => {
        if (!route.stops || route.stops.length === 0) return null;
        if (visibleRouteIds && !visibleRouteIds.has(route.id)) return null;

        const coordinates = route.path && route.path.length > 1
          ? route.path
          : route.stops
            .map((stopId) => transitData.stops[stopId])
            .filter((stop) => stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
            .map((stop) => [stop.lat, stop.lng]);

        if (coordinates.length < 2) return null;

        const simplifiedCoordinates = simplifyPath(coordinates);
        const availableDirectionKeys = route.directions ? Object.keys(route.directions) : ['0'];
        const activeDirectionKey = availableDirectionKeys.includes(String(selectedDirection))
          ? String(selectedDirection)
          : availableDirectionKeys[0] || '0';
        const routeDirectionStops = route.directions?.[activeDirectionKey] || route.stops || [];
        const allDirectionStops = route.directions
          ? [...new Set(Object.values(route.directions).flat())]
          : route.stops || [];
        const globalRiddenStops = new Set();

        if (riddenStopsByRoute?.[route.id]) {
          Object.values(riddenStopsByRoute[route.id]).forEach((stopSet) => {
            if (stopSet) {
              stopSet.forEach((stopId) => globalRiddenStops.add(stopId));
            }
          });
        }

        const rideProgress = allDirectionStops.length
          ? (globalRiddenStops.size / allDirectionStops.length) * 100
          : 0;

        const riddenStops = new Set(riddenStopsByRoute?.[route.id]?.[activeDirectionKey] || []);

        return {
          route,
          coordinates: simplifiedCoordinates,
          bounds: simplifiedCoordinates,
          isSelected: selectedRouteId === route.id,
          rideProgress,
          routeDirectionStops,
          riddenStops,
          activeDirectionKey,
        };
      })
      .filter(Boolean);
  }, [riddenStopsByRoute, selectedDirection, selectedRouteId, transitData, visibleRouteIds]);

  const selectedRoute = selectedRouteId
    ? transitData?.routes.find((route) => route.id === selectedRouteId) || null
    : null;

  const selectedBounds = selectedRoute
    ? routePolylines.find(({ route }) => route.id === selectedRoute.id)?.bounds || null
    : null;

  const directionOptions = selectedRoute && selectedRoute.directions
    ? Object.keys(selectedRoute.directions)
    : ['0'];

  const resolvedDirectionKey = selectedRoute && selectedRoute.directions
    ? (directionOptions.includes(String(selectedDirection)) ? String(selectedDirection) : directionOptions[0] || '0')
    : '0';

  const selectedDirectionStops = selectedRoute
    ? (selectedRoute.directions?.[resolvedDirectionKey] || selectedRoute.stops || [])
    : [];

  const selectedRiddenStops = new Set(
    selectedRoute ? riddenStopsByRoute?.[selectedRoute.id]?.[resolvedDirectionKey] || [] : []
  );

  const routeUniqueStops = selectedRoute?.stops || [];
  const globalRiddenStops = new Set();

  if (selectedRoute && riddenStopsByRoute[selectedRoute.id]) {
    Object.values(riddenStopsByRoute[selectedRoute.id]).forEach((stopSet) => {
      if (stopSet) {
        stopSet.forEach((stopId) => globalRiddenStops.add(stopId));
      }
    });
  }

  const progressPercent = selectedRoute && routeUniqueStops.length
    ? Math.round((globalRiddenStops.size / routeUniqueStops.length) * 100)
    : 0;

  return (
    <div className="map-container">
      <MapContainer center={[47.6, -122.33]} zoom={11} scrollWheelZoom className="map">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routePolylines.map(({ route, coordinates, isSelected, rideProgress }) => {
          return (
            <React.Fragment key={route.id}>
              <Polyline
                positions={coordinates}
                pathOptions={{
                  color: isSelected ? '#2ecc71' : route.color || '#999999',
                  weight: isSelected ? 5 : 3,
                  opacity: isSelected ? 1 : 0.7,
                  smoothFactor: 2,
                  dashArray: rideProgress > 0 && rideProgress < 100 ? '8 10' : undefined,
                }}
                eventHandlers={{
                  click: () => onRouteSelect(route.id),
                  mouseover: (e) => {
                    e.target.setStyle({ weight: 4, opacity: 0.9 });
                  },
                  mouseout: (e) => {
                    if (selectedRouteId !== route.id) {
                      e.target.setStyle({ weight: 3, opacity: 0.7 });
                    }
                  },
                }}
              />
            </React.Fragment>
          );
        })}

        {selectedBounds && <FitMapToRoute route={selectedRoute} bounds={selectedBounds} />}
      </MapContainer>

      {selectedRoute && (
        <div className="route-panel">
          <button className="close-btn" onClick={() => onRouteSelect(null)}>
            ✕
          </button>
          <h3>{selectedRoute.shortName || 'Route'}</h3>
          <p className="route-name">{selectedRoute.longName}</p>
          <div
            className="route-color"
            style={{ backgroundColor: selectedRoute.color || '#999999' }}
          ></div>
          <p className="stops-count">{selectedRoute.stops?.length || 0} stops</p>

          <div className="direction-toggle-group">
            {['0', '1'].map((directionKey) => {
              const label = directionKey === '0' ? 'Going' : 'Returning';
              return (
                <button
                  key={directionKey}
                  className={`direction-toggle ${selectedDirection === directionKey ? 'active' : ''}`}
                  onClick={() => onDirectionSelect(directionKey)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="route-progress-row">
            <span className="progress-label">Global route progress</span>
            <strong>{progressPercent}%</strong>
          </div>

          <div className="route-action-row">
            <button className="route-action-button" onClick={() => onCompleteEntireLine(selectedRoute.id)}>
              Complete entire line
            </button>
            <button className="route-action-button secondary" onClick={() => onResetRoute(selectedRoute.id)}>
              Reset route
            </button>
          </div>

          <div className="partial-progress">
            Route completion counts unique stops across both directions.
          </div>

          <div className="stop-list">
            {selectedDirectionStops.map((stopId) => {
              const stop = transitData.stops[stopId];
              return (
                <label key={stopId} className="stop-item">
                  <input
                    type="checkbox"
                    checked={selectedRiddenStops.has(stopId)}
                    onChange={() => onToggleStop(selectedRoute.id, stopId, resolvedDirectionKey)}
                  />
                  <span>{stop?.name || stopId}</span>
                </label>
              );
            })}
          </div>

          <div className="partial-progress">
            Selecting a stop auto-fills every stop in between on this direction.
          </div>
        </div>
      )}
    </div>
  );
}

export default Map;
