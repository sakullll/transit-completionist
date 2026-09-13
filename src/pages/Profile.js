import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Profile.css';

const PROGRESS_KEY = 'transit-completionist-progress';
const COMPLETION_DATES_KEY = 'transit-completionist-completion-dates';

function getTransitDataUrl() {
  const publicUrl = (process.env.PUBLIC_URL || '/transit-completionist').replace(/\/$/, '');
  return `${publicUrl}/data/seattle.json`;
}

function Profile() {
  const [transitData, setTransitData] = useState(null);
  const [completionDates, setCompletionDates] = useState({});

  useEffect(() => {
    const savedDates = localStorage.getItem(COMPLETION_DATES_KEY);
    if (savedDates) {
      try {
        setCompletionDates(JSON.parse(savedDates));
      } catch (error) {
        console.error('Error loading completion dates:', error);
      }
    }

    fetch(getTransitDataUrl())
      .then((res) => res.json())
      .then((data) => setTransitData(data))
      .catch((error) => console.error('Error loading transit data:', error));
  }, []);

  const completedRoutes = useMemo(() => {
    if (!transitData?.routes) return [];

    const savedProgress = localStorage.getItem(PROGRESS_KEY);
    const parsedProgress = savedProgress ? JSON.parse(savedProgress) : {};

    return transitData.routes
      .filter((route) => {
        const routeProgress = parsedProgress[route.id] || {};
        const routeStops = route.stops || [];
        const uniqueStops = new Set();

        Object.values(routeProgress).forEach((stopSet) => {
          if (stopSet) {
            stopSet.forEach((stopId) => uniqueStops.add(stopId));
          }
        });

        return routeStops.length > 0 && uniqueStops.size >= routeStops.length;
      })
      .map((route) => ({
        id: route.id,
        name: route.longName || route.shortName || `Route ${route.id}`,
        date: completionDates[route.id] || new Date().toISOString().slice(0, 10),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [completionDates, transitData]);

  const totalRoutes = transitData?.routes?.length || 0;
  const completionPercent = totalRoutes ? Math.round((completedRoutes.length / totalRoutes) * 100) : 0;

  const handleCompletionDateChange = (routeId, date) => {
    const nextDates = { ...completionDates, [routeId]: date };
    setCompletionDates(nextDates);
    localStorage.setItem(COMPLETION_DATES_KEY, JSON.stringify(nextDates));
  };

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
            <div className="progress-fill" style={{ width: `${completionPercent}%` }}></div>
          </div>
          <p>{completionPercent}% Complete</p>
          <small>{completedRoutes.length} of {totalRoutes} lines completed</small>
        </div>

        <div className="achievements">
          <h3>Achievements</h3>
          {completedRoutes.length === 0 ? (
            <p>Start exploring to unlock achievements!</p>
          ) : (
            <div className="achievement-list">
              {completedRoutes.map((route) => (
                <div key={route.id} className="achievement-item">
                  <div>
                    <strong>{route.name}</strong>
                    <p>Line complete</p>
                  </div>
                  <label className="achievement-date-field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={route.date}
                      onChange={(event) => handleCompletionDateChange(route.id, event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;