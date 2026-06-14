import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Dashboard.css';

function Dashboard() {
  const [transitData, setTransitData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load transit data
    fetch(`${process.env.PUBLIC_URL}/data/seattle.json`)
      .then(res => res.json())
      .then(data => {
        setTransitData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading transit data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div>
        <nav className="nav">
          <h1>🚌 Transit Completionist</h1>
          <div>
            <Link to="/">Home</Link>
            <Link to="/profile">Profile</Link>
          </div>
        </nav>
        <div className="container">
          <p>Loading transit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="nav">
        <h1>🚌 Transit Completionist</h1>
        <div>
          <Link to="/">Home</Link>
          <Link to="/profile">Profile</Link>
        </div>
      </nav>
      <div className="container">
        <h2>Interactive Transit Map</h2>
        <p>Coming soon: Interactive Leaflet map will display here</p>
        {transitData && (
          <div className="data-preview">
            <p>✅ Transit data loaded: {transitData.routes?.length || 0} routes</p>
            <p>📍 Stops available: {Object.keys(transitData.stops || {}).length}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;