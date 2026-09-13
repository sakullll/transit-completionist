const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configure these paths based on where you extracted GTFS
const GTFS_INPUT_DIR = './gtfs'; // Your extracted GTFS folder
const OUTPUT_DIR = './public/data';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'seattle.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const routes = [];
const stops = {};
const stopTimes = {};
const shapePoints = {};

console.log('📍 Parsing GTFS data...\n');

// Parse routes.txt
fs.createReadStream(path.join(GTFS_INPUT_DIR, 'routes.txt'))
  .pipe(csv())
  .on('data', (row) => {
    routes.push({
      id: row.route_id,
      shortName: row.route_short_name || '',
      longName: row.route_long_name || '',
      type: row.route_type,
      color: row.route_color ? `#${row.route_color}` : '#999999',
      agency: row.agency_id || 'Unknown'
    });
  })
  .on('end', () => {
    console.log(`✅ Routes parsed: ${routes.length}`);
    parseStops();
  });

// Parse stops.txt
function parseStops() {
  fs.createReadStream(path.join(GTFS_INPUT_DIR, 'stops.txt'))
    .pipe(csv())
    .on('data', (row) => {
      stops[row.stop_id] = {
        id: row.stop_id,
        name: row.stop_name,
        lat: parseFloat(row.stop_lat),
        lng: parseFloat(row.stop_lon),
        code: row.stop_code || ''
      };
    })
    .on('end', () => {
      console.log(`✅ Stops parsed: ${Object.keys(stops).length}`);
      parseShapes();
    });
}

// Parse shape geometry for route paths.
function parseShapes() {
  fs.createReadStream(path.join(GTFS_INPUT_DIR, 'shapes.txt'))
    .pipe(csv())
    .on('data', (row) => {
      const shapeId = row.shape_id;
      if (!shapeId) return;

      if (!shapePoints[shapeId]) {
        shapePoints[shapeId] = [];
      }

      shapePoints[shapeId].push({
        lat: parseFloat(row.shape_pt_lat),
        lng: parseFloat(row.shape_pt_lon),
        sequence: parseInt(row.shape_pt_sequence, 10) || 0,
      });
    })
    .on('end', () => {
      Object.keys(shapePoints).forEach((shapeId) => {
        shapePoints[shapeId].sort((a, b) => a.sequence - b.sequence);
      });

      console.log(`✅ Shapes parsed: ${Object.keys(shapePoints).length}`);
      parseStopTimes();
    });
}

// Parse stop_times.txt to map stops to routes in GTFS stop order.
function parseStopTimes() {
  fs.createReadStream(path.join(GTFS_INPUT_DIR, 'stop_times.txt'))
    .pipe(csv())
    .on('data', (row) => {
      const tripId = row.trip_id;
      const stopId = row.stop_id;
      const stopSequence = parseInt(row.stop_sequence, 10);

      if (!stopTimes[tripId]) {
        stopTimes[tripId] = [];
      }

      stopTimes[tripId].push({
        stopId,
        sequence: Number.isFinite(stopSequence) ? stopSequence : Number.MAX_SAFE_INTEGER
      });
    })
    .on('end', () => {
      console.log(`✅ Stop times parsed: ${Object.keys(stopTimes).length} trips`);
      parseTrips();
    });
}

// Parse trips.txt to connect trips to routes while preserving stop order.
function parseTrips() {
  const trips = {};
  const routeShapeIds = {};

  fs.createReadStream(path.join(GTFS_INPUT_DIR, 'trips.txt'))
    .pipe(csv())
    .on('data', (row) => {
      const routeId = row.route_id;
      const shapeId = row.shape_id || '';
      const directionId = row.direction_id || '0';

      if (!trips[row.trip_id]) {
        trips[row.trip_id] = { routeId, shapeId, directionId };
      }

      if (shapeId && !routeShapeIds[routeId]) {
        routeShapeIds[routeId] = shapeId;
      }
    })
    .on('end', () => {
      console.log(`✅ Trips parsed: ${Object.keys(trips).length}`);

      const routeStops = {};

      routes.forEach((route) => {
        routeStops[route.id] = { 0: new Map(), 1: new Map() };
      });

      Object.entries(trips).forEach(([tripId, { routeId, shapeId, directionId }]) => {
        if (!stopTimes[tripId] || !routeStops[routeId]) {
          return;
        }

        const orderedStops = [...stopTimes[tripId]].sort((a, b) => a.sequence - b.sequence);

        orderedStops.forEach(({ stopId, sequence }) => {
          const directionKey = directionId === '1' ? '1' : '0';
          if (!routeStops[routeId][directionKey].has(stopId)) {
            routeStops[routeId][directionKey].set(stopId, { stopId, sequence });
          }
        });

        if (shapeId && shapePoints[shapeId] && !routeShapeIds[routeId]) {
          routeShapeIds[routeId] = shapeId;
        }
      });

      routes.forEach((route) => {
        const directionMap = {};

        ['0', '1'].forEach((directionKey) => {
          const orderedStopIds = [...(routeStops[route.id]?.[directionKey]?.values() || [])]
            .sort((a, b) => a.sequence - b.sequence)
            .map(({ stopId }) => stopId);

          if (orderedStopIds.length > 0) {
            directionMap[directionKey] = orderedStopIds;
          }
        });

        route.stops = [...new Set(Object.values(directionMap).flat())];
        route.directions = Object.keys(directionMap).length > 0 ? directionMap : { 0: route.stops };

        const shapeId = routeShapeIds[route.id];
        const path = shapeId && shapePoints[shapeId]
          ? shapePoints[shapeId]
            .sort((a, b) => a.sequence - b.sequence)
            .map(({ lat, lng }) => [lat, lng])
          : route.stops
            .map((stopId) => stops[stopId])
            .filter((stop) => stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
            .map(({ lat, lng }) => [lat, lng]);

        route.path = path;
      });

      saveData();
    });
}

// Save processed data to JSON
function saveData() {
  const data = {
    routes,
    stops,
    lastUpdated: new Date().toISOString(),
    metadata: {
      totalRoutes: routes.length,
      totalStops: Object.keys(stops).length
    }
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));

  console.log('\n✅ All data parsed successfully!');
  console.log(`📁 Saved to: ${OUTPUT_FILE}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Routes: ${routes.length}`);
  console.log(`   Stops: ${Object.keys(stops).length}`);
}