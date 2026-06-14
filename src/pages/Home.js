import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

function Home() {
  return (
    <div>
      <nav className="nav">
        <h1>🚌 Transit Completionist</h1>
        <div>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/profile">Profile</Link>
        </div>
      </nav>
      <div className="container">
        <div className="hero">
          <h2>Welcome to Transit Completionist</h2>
          <p>Track every line and stop on the Puget Sound ORCA system</p>
          <Link to="/dashboard" className="cta-button">
            Start Exploring →
          </Link>
        </div>
        <div className="features">
          <div className="feature">
            <h3>🗺️ Interactive Map</h3>
            <p>Explore all ORCA transit lines on an interactive scratch-off map</p>
          </div>
          <div className="feature">
            <h3>📊 Progress Tracking</h3>
            <p>See your completion percentage by agency and line</p>
          </div>
          <div className="feature">
            <h3>🏆 Achievements</h3>
            <p>Unlock badges as you explore more of the transit system</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;