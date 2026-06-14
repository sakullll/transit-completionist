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
let processedCount = 0;

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
      parseStopTimes();
    });
}

// Parse stop_times.txt to map stops to routes
function parseStopTimes() {
  fs.createReadStream(path.join(GTFS_INPUT_DIR, 'stop_times.txt'))
    .pipe(csv())
    .on('data', (row) => {
      const tripId = row.trip_id;
      const stopId = row.stop_id;
      const stopSequence = parseInt(row.stop_sequence);
      
      if (!stopTimes[tripId]) {
        stopTimes[tripId] = [];
      }
      stopTimes[tripId].push({
        stopId,
        sequence: stopSequence
      });
    })
    .on('end', () => {
      console.log(`✅ Stop times parsed: ${Object.keys(stopTimes).length} trips`);
      parseTrips();
    });
}

// Parse trips.txt to connect trips to routes
function parseTrips() {
  const trips = {};
  
  fs.createReadStream(path.join(GTFS_INPUT_DIR, 'trips.txt'))
    .pipe(csv())
    .on('data', (row) => {
      trips[row.trip_id] = row.route_id;
    })
    .on('end', () => {
      console.log(`✅ Trips parsed: ${Object.keys(trips).length}`);
      
      // Map stops to routes
      const routeStops = {};
      
      routes.forEach(route => {
        routeStops[route.id] = new Set();
      });
      
      Object.entries(trips).forEach(([tripId, routeId]) => {
        if (stopTimes[tripId] && routeStops[routeId]) {
          stopTimes[tripId].forEach(st => {
            routeStops[routeId].add(st.stopId);
          });
        }
      });
      
      // Convert sets to arrays and enhance routes with stops
      routes.forEach(route => {
        route.stops = Array.from(routeStops[route.id] || []);
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
