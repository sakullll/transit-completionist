import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Profile.css';

function Profile() {
  return (
    <div>
      <nav className="nav">
        <h1>🚌 Transit Completionist</h1>
        <div>
          <Link to="/">Home</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
      </nav>
      <div className="container">
        <h2>Your Progress</h2>
        <div className="progress-card">
          <h3>Overall Progress</h3>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '0%' }}></div>
          </div>
          <p>0% Complete</p>
        </div>
        <div className="achievements">
          <h3>Achievements</h3>
          <p>Start exploring to unlock achievements!</p>
        </div>
      </div>
    </div>
  );
}

export default Profile;