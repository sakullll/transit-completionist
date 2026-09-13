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
          <p>Track every bus, rail, and ferry line in the Puget Sound transit network.</p>
          <Link to="/dashboard" className="cta-button">
            Open Progress Dashboard →
          </Link>
        </div>
        <div className="features">
          <div className="feature">
            <h3>📊 Route Progress</h3>
            <p>See every line and its completion percentage in a single progress ledger.</p>
          </div>
          <div className="feature">
            <h3>🧭 Route Explorer</h3>
            <p>Search any route by name and jump straight into its stop tracking panel.</p>
          </div>
          <div className="feature">
            <h3>🏆 Achievements</h3>
            <p>Celebrate fully completed lines and keep track of your historical transit milestones.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;