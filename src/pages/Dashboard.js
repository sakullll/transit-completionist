import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Map from '../components/Map';
import '../styles/Dashboard.css';

const ROUTE_TYPE_LABELS = {
  '0': 'Tram',
  '1': 'Subway',
  '2': 'Rail',
  '3': 'Bus',
  '4': 'Ferry',
  '5': 'Cable',
  '6': 'Aerial',
  '7': 'Funicular',
};

const STORAGE_KEY = 'transit-completionist-progress';

function getTransitDataUrl() {
  const publicUrl = (process.env.PUBLIC_URL || '/transit-completionist').replace(/\/$/, '');
  return `${publicUrl}/data/seattle.json`;
}

function getRouteProgressStats(route, riddenStopsByRoute) {
  if (!route) return { uniqueStops: 0, totalStops: 0, percent: 0, complete: false, directionSummary: {} };

  const routeProgress = riddenStopsByRoute[route.id] || {};
  const uniqueStopIds = new Set();
  const directionSummary = {};
  const directionKeys = route.directions ? Object.keys(route.directions) : ['0'];

  directionKeys.forEach((directionKey) => {
    const directionStops = route.directions?.[directionKey] || route.stops || [];
    const stopSet = new Set(routeProgress[directionKey] || []);
    directionSummary[directionKey] = {
      ridden: stopSet.size,
      total: directionStops.length,
    };

    stopSet.forEach((stopId) => uniqueStopIds.add(stopId));
  });

  const totalStops = route.stops?.length || 0;
  const percent = totalStops ? Math.round((uniqueStopIds.size / totalStops) * 100) : 0;

  return {
    uniqueStops: uniqueStopIds.size,
    totalStops,
    percent,
    complete: totalStops > 0 && uniqueStopIds.size >= totalStops,
    directionSummary,
  };
}

function deserializeProgress(rawProgress) {
  if (!rawProgress || typeof rawProgress !== 'object') return {};

  return Object.entries(rawProgress).reduce((acc, [routeId, directionMap]) => {
    const nextDirectionMap = {};

    Object.entries(directionMap || {}).forEach(([directionKey, stopIds]) => {
      nextDirectionMap[directionKey] = new Set(Array.isArray(stopIds) ? stopIds : []);
    });

    if (Object.keys(nextDirectionMap).length > 0) {
      acc[routeId] = nextDirectionMap;
    }

    return acc;
  }, {});
}

function Dashboard() {
  const [transitData, setTransitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedDirection, setSelectedDirection] = useState('0');
  const [riddenStopsByRoute, setRiddenStopsByRoute] = useState({});
  const [activeRouteTypes, setActiveRouteTypes] = useState(new Set(['all']));
  const [routeSearch, setRouteSearch] = useState('');
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [fetchError, setFetchError] = useState(null);
  const [tableFilters, setTableFilters] = useState({
    line: '',
    type: 'all',
    percent: 'all',
    going: 'all',
    returning: 'all',
    status: 'all',
  });
  const resetHoldTimeoutRef = useRef(null);
  const [resetHoldActive, setResetHoldActive] = useState(false);
  const [resetHoldProgress, setResetHoldProgress] = useState(0);

  useEffect(() => {
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress) {
      try {
        setRiddenStopsByRoute(deserializeProgress(JSON.parse(savedProgress)));
      } catch (error) {
        console.error('Error restoring saved progress:', error);
      }
    }

    setFetchError(null);
    fetch(getTransitDataUrl())
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setTransitData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading transit data:', err);
        setFetchError('Transit data could not be loaded. Please refresh the page or try again later.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!transitData) return;

    const serializedProgress = Object.entries(riddenStopsByRoute).reduce((acc, [routeId, directionMap]) => {
      const nextDirectionMap = {};

      Object.entries(directionMap || {}).forEach(([directionKey, stopSet]) => {
        nextDirectionMap[directionKey] = [...(stopSet instanceof Set ? stopSet : new Set())];
      });

      if (Object.keys(nextDirectionMap).length > 0) {
        acc[routeId] = nextDirectionMap;
      }

      return acc;
    }, {});

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedProgress));
  }, [riddenStopsByRoute, transitData]);

  const routeTypes = useMemo(() => {
    if (!transitData?.routes) return [];

    const seen = new Set();
    const values = transitData.routes
      .map((route) => String(route.type))
      .filter((type) => {
        if (!type || seen.has(type)) return false;
        seen.add(type);
        return true;
      })
      .sort((a, b) => Number(a) - Number(b))
      .map((type) => ({
        key: type,
        label: ROUTE_TYPE_LABELS[type] || `Type ${type}`,
      }));

    return [{ key: 'all', label: 'All' }, ...values];
  }, [transitData]);

  const visibleRouteIds = useMemo(() => {
    if (!transitData?.routes) return new Set();

    const active = activeRouteTypes;
    return new Set(
      transitData.routes
        .filter((route) => {
          if (active.has('all')) return true;
          return active.has(String(route.type));
        })
        .map((route) => route.id)
    );
  }, [activeRouteTypes, transitData]);

  const completionProgress = useMemo(() => {
    if (!transitData?.routes) return 0;

    const allRoutes = transitData.routes;
    const totalStops = allRoutes.reduce((sum, route) => sum + (route.stops?.length || 0), 0);
    const riddenStops = allRoutes.reduce((sum, route) => {
      const progress = riddenStopsByRoute[route.id] || {};
      return sum + Object.values(progress).reduce((innerSum, ids) => innerSum + (ids ? ids.size : 0), 0);
    }, 0);

    if (totalStops === 0) return 0;
    return Math.round((riddenStops / totalStops) * 100);
  }, [riddenStopsByRoute, transitData]);

  const completedLines = useMemo(() => {
    if (!transitData?.routes) return 0;

    return transitData.routes.filter((route) => {
      const routeStops = route.stops || [];
      if (routeStops.length === 0) return false;

      const uniqueRouteStops = new Set();
      const routeProgress = riddenStopsByRoute[route.id] || {};

      Object.values(routeProgress).forEach((stopSet) => {
        if (stopSet) {
          stopSet.forEach((stopId) => uniqueRouteStops.add(stopId));
        }
      });

      return uniqueRouteStops.size >= routeStops.length;
    }).length;
  }, [riddenStopsByRoute, transitData]);

  const allUniqueRiddenStops = useMemo(() => {
    if (!transitData?.routes) return 0;

    const uniqueStops = new Set();
    transitData.routes.forEach((route) => {
      const routeProgress = riddenStopsByRoute[route.id] || {};
      Object.values(routeProgress).forEach((stopSet) => {
        if (stopSet) {
          stopSet.forEach((stopId) => uniqueStops.add(stopId));
        }
      });
    });

    return uniqueStops.size;
  }, [riddenStopsByRoute, transitData]);

  const getProgressBucket = (percent) => {
    if (percent >= 100) return '100';
    if (percent >= 75) return '75-99';
    if (percent >= 50) return '50-74';
    if (percent >= 25) return '25-49';
    if (percent >= 1) return '1-24';
    return '0';
  };

  const routeRows = useMemo(() => {
    if (!transitData?.routes) return [];

    return transitData.routes
      .map((route) => {
        const stats = getRouteProgressStats(route, riddenStopsByRoute);
        const routeName = route.longName || route.shortName || `Route ${route.id}`;

        return {
          id: route.id,
          name: routeName,
          shortName: route.shortName,
          type: route.type,
          ...stats,
        };
      })
      .filter((row) => visibleRouteIds.has(row.id))
      .sort((a, b) => {
        if (a.complete !== b.complete) return Number(b.complete) - Number(a.complete);
        return b.percent - a.percent || a.name.localeCompare(b.name);
      });
  }, [riddenStopsByRoute, transitData, visibleRouteIds]);

  const filteredRouteRows = useMemo(() => {
    return routeRows.filter((row) => {
      const lineMatch = !tableFilters.line || `${row.shortName || ''} ${row.name || ''}`.toLowerCase().includes(tableFilters.line.toLowerCase());
      const typeMatch = tableFilters.type === 'all' || String(row.type) === tableFilters.type;
      const percentBucket = getProgressBucket(row.percent);
      const percentMatch = tableFilters.percent === 'all' || percentBucket === tableFilters.percent;

      const goingSummary = row.directionSummary?.['0'] || { ridden: 0, total: 0 };
      const returningSummary = row.directionSummary?.['1'] || { ridden: 0, total: 0 };
      const goingPercent = goingSummary.total ? Math.round((goingSummary.ridden / goingSummary.total) * 100) : 0;
      const returningPercent = returningSummary.total ? Math.round((returningSummary.ridden / returningSummary.total) * 100) : 0;
      const goingMatch = tableFilters.going === 'all' || getProgressBucket(goingPercent) === tableFilters.going;
      const returningMatch = tableFilters.returning === 'all' || getProgressBucket(returningPercent) === tableFilters.returning;

      const statusValue = row.complete ? 'complete' : row.percent > 0 ? 'in-progress' : 'not-started';
      const statusMatch = tableFilters.status === 'all' || statusValue === tableFilters.status;

      return lineMatch && typeMatch && percentMatch && goingMatch && returningMatch && statusMatch;
    });
  }, [routeRows, tableFilters]);

  const routeSearchOptions = useMemo(() => {
    if (!transitData?.routes) return [];

    const query = routeSearch.trim().toLowerCase();
    if (!query) return [];

    return transitData.routes
      .map((route) => {
        const searchLabel = [route.shortName, route.longName].filter(Boolean).join(' ');
        return {
          route,
          searchLabel,
          matches: searchLabel.toLowerCase().includes(query),
        };
      })
      .filter((entry) => entry.matches)
      .slice(0, 12)
      .map(({ route, searchLabel }) => ({
        id: route.id,
        label: searchLabel || `Route ${route.id}`,
      }));
  }, [routeSearch, transitData]);

  const handleRouteSelect = (routeId) => {
    setSelectedRouteId(routeId);

    if (!routeId || !transitData?.routes) return;

    const route = transitData.routes.find((item) => item.id === routeId);
    if (!route) return;

    setActiveRouteTypes((current) => {
      const next = new Set(current);
      next.delete('all');
      next.add(String(route.type));
      return next;
    });

    const availableDirections = route?.directions ? Object.keys(route.directions) : ['0'];
    setSelectedDirection((current) => (
      availableDirections.includes(String(current)) ? String(current) : availableDirections[0] || '0'
    ));
  };

  const handleRouteSearchSubmit = () => {
    const normalized = routeSearch.trim();
    if (!normalized || !transitData?.routes) return;

    const match = transitData.routes.find((route) => {
      const labels = [route.shortName, route.longName, `${route.shortName || ''} ${route.longName || ''}`.trim()]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

      return labels.some((label) => label.includes(normalized.toLowerCase()));
    });

    if (match) {
      setRouteSearch(match.longName || match.shortName || `Route ${match.id}`);
      handleRouteSelect(match.id);
    }
  };

  const toggleRouteType = (type) => {
    setActiveRouteTypes((current) => {
      const next = new Set(current);

      if (type === 'all') {
        return new Set(['all']);
      }

      next.delete('all');

      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }

      return next.size === 0 ? new Set(['all']) : next;
    });
  };

  const toggleRiddenStop = (routeId, stopId, directionKey = '0') => {
    const route = transitData?.routes.find((item) => item.id === routeId);
    const routeBefore = route ? getRouteProgressStats(route, riddenStopsByRoute) : { complete: false };

    setRiddenStopsByRoute((current) => {
      const next = { ...current };
      const routeDirectionMap = { ...(next[routeId] || {}) };
      const stopSet = new Set(routeDirectionMap[directionKey] || []);

      if (stopSet.has(stopId)) {
        stopSet.delete(stopId);
      } else {
        const directionStops = transitData.routes.find((item) => item.id === routeId)?.directions?.[directionKey] || [];
        const orderedStops = directionStops.slice();
        const stopIndex = orderedStops.indexOf(stopId);
        const checked = [...stopSet];

        if (checked.length === 0) {
          stopSet.add(stopId);
        } else {
          const indexes = checked
            .map((id) => orderedStops.indexOf(id))
            .filter((index) => index >= 0)
            .sort((a, b) => a - b);

          if (indexes.length > 0) {
            const start = Math.min(stopIndex, indexes[0]);
            const end = Math.max(stopIndex, indexes[indexes.length - 1]);

            for (let i = start; i <= end; i += 1) {
              stopSet.add(orderedStops[i]);
            }
          } else {
            stopSet.add(stopId);
          }
        }
      }

      if (stopSet.size === 0) {
        delete routeDirectionMap[directionKey];
      } else {
        routeDirectionMap[directionKey] = stopSet;
      }

      if (Object.keys(routeDirectionMap).length === 0) {
        delete next[routeId];
      } else {
        next[routeId] = routeDirectionMap;
      }

      const afterComplete = route ? getRouteProgressStats(route, next).complete : false;
      if (!routeBefore.complete && afterComplete) {
        setCelebrationKey(Date.now());
      }

      return next;
    });
  };

  const completeEntireLine = (routeId) => {
    const route = transitData?.routes.find((item) => item.id === routeId);
    if (!route || !route.stops) return;

    const routeBefore = getRouteProgressStats(route, riddenStopsByRoute);

    setRiddenStopsByRoute((current) => {
      const next = { ...current };
      const routeDirectionMap = { ...(next[routeId] || {}) };

      route.directions = route.directions || { 0: route.stops };
      Object.keys(route.directions).forEach((directionKey) => {
        routeDirectionMap[directionKey] = new Set(route.directions[directionKey]);
      });

      next[routeId] = routeDirectionMap;
      const afterComplete = getRouteProgressStats(route, next).complete;
      if (!routeBefore.complete && afterComplete) {
        setCelebrationKey(Date.now());
      }
      return next;
    });
  };

  const resetRoute = (routeId) => {
    setRiddenStopsByRoute((current) => {
      const next = { ...current };
      delete next[routeId];
      return next;
    });
  };

  const resetAllProgress = () => {
    setRiddenStopsByRoute({});
    setResetHoldActive(false);
    setResetHoldProgress(0);
    if (resetHoldTimeoutRef.current) {
      clearTimeout(resetHoldTimeoutRef.current);
      resetHoldTimeoutRef.current = null;
    }
  };

  const beginResetHold = () => {
    if (resetHoldTimeoutRef.current) {
      clearTimeout(resetHoldTimeoutRef.current);
    }

    const startedAt = Date.now();
    setResetHoldActive(true);
    setResetHoldProgress(0);

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min((elapsed / 1200) * 100, 100);
      setResetHoldProgress(nextProgress);

      if (elapsed < 1200) {
        resetHoldTimeoutRef.current = setTimeout(tick, 16);
      } else {
        resetAllProgress();
      }
    };

    resetHoldTimeoutRef.current = setTimeout(tick, 16);
  };

  const cancelResetHold = () => {
    if (resetHoldTimeoutRef.current) {
      clearTimeout(resetHoldTimeoutRef.current);
      resetHoldTimeoutRef.current = null;
    }
    setResetHoldActive(false);
    setResetHoldProgress(0);
  };

  const chooseRandomIncompleteRoute = () => {
    if (!transitData?.routes) return;

    const incompleteRoutes = transitData.routes.filter((route) => {
      const stats = getRouteProgressStats(route, riddenStopsByRoute);
      return !stats.complete;
    });

    if (incompleteRoutes.length === 0) return;

    const randomRoute = incompleteRoutes[Math.floor(Math.random() * incompleteRoutes.length)];
    setRouteSearch(randomRoute.longName || randomRoute.shortName || `Route ${randomRoute.id}`);
    handleRouteSelect(randomRoute.id);
  };

  useEffect(() => {
    return () => {
      if (resetHoldTimeoutRef.current) {
        clearTimeout(resetHoldTimeoutRef.current);
      }
    };
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
        <h2>Route Progress Dashboard</h2>
        <p>Search, filter, and track every line in a single place.</p>

        {fetchError && (
          <div className="route-error-banner" role="alert">
            {fetchError}
          </div>
        )}

        {celebrationKey > 0 && <div className="celebration-burst" key={celebrationKey} aria-live="polite">{Array.from({ length: 28 }).map((_, index) => (
          <span
            key={`${celebrationKey}-${index}`}
            className="confetti-piece"
            style={{
              '--piece-index': index,
              '--x-shift': `${(index % 7 - 3) * 18}px`,
              '--rotation': `${index * 28}deg`,
            }}
          />
        ))}</div>}

        <div className="tool-panel">
          <div className="route-search-panel">
            <label className="route-search-label" htmlFor="route-search">Find route</label>
            <input
              id="route-search"
              className="route-search-input"
              list="route-search-options"
              value={routeSearch}
              placeholder="Search by route name..."
              onChange={(event) => setRouteSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleRouteSearchSubmit();
                }
              }}
            />
            <datalist id="route-search-options">
              {routeSearchOptions.map((option) => (
                <option key={option.id} value={option.label} />
              ))}
            </datalist>
          </div>

          <div className="route-toggle-group">
            {routeTypes.map((type) => (
              <button
                key={type.key}
                className={`route-toggle ${activeRouteTypes.has(type.key) ? 'active' : ''}`}
                onClick={() => toggleRouteType(type.key)}
              >
                {type.label}
              </button>
            ))}
            <button className="route-toggle suggestion-button" onClick={chooseRandomIncompleteRoute}>
              Suggest a route
            </button>
          </div>

          <div className="completion-card">
            <span className="label">Ride progress</span>
            <strong>{completionProgress}%</strong>
            <small>{allUniqueRiddenStops} unique stops ridden</small>
            <small>{completedLines} lines completed</small>
          </div>
        </div>

        {transitData && (
          <Map
            transitData={transitData}
            selectedRouteId={selectedRouteId}
            onRouteSelect={handleRouteSelect}
            visibleRouteIds={visibleRouteIds}
            riddenStopsByRoute={riddenStopsByRoute}
            onToggleStop={toggleRiddenStop}
            selectedDirection={selectedDirection}
            onDirectionSelect={setSelectedDirection}
            onCompleteEntireLine={completeEntireLine}
            onResetRoute={resetRoute}
          />
        )}

        {transitData && (
          <div className="route-table-panel">
            <div className="route-table-header">
              <h3>All route progress</h3>
              <span>{routeRows.length} lines visible</span>
            </div>

            <div className="route-table-wrapper">
              <table className="route-progress-table">
                <thead>
                  <tr>
                    <th>
                      <div className="table-filter-header">Line</div>
                      <input
                        className="table-filter-input"
                        value={tableFilters.line}
                        placeholder="Filter line"
                        onChange={(event) => setTableFilters((current) => ({ ...current, line: event.target.value }))}
                      />
                    </th>
                    <th>
                      <div className="table-filter-header">Type</div>
                      <select
                        className="table-filter-input"
                        value={tableFilters.type}
                        onChange={(event) => setTableFilters((current) => ({ ...current, type: event.target.value }))}
                      >
                        <option value="all">All</option>
                        {routeTypes.filter((type) => type.key !== 'all').map((type) => (
                          <option key={type.key} value={type.key}>{type.label}</option>
                        ))}
                      </select>
                    </th>
                    <th>
                      <div className="table-filter-header">%</div>
                      <select
                        className="table-filter-input"
                        value={tableFilters.percent}
                        onChange={(event) => setTableFilters((current) => ({ ...current, percent: event.target.value }))}
                      >
                        <option value="all">All</option>
                        <option value="100">100%</option>
                        <option value="75-99">75-99%</option>
                        <option value="50-74">50-74%</option>
                        <option value="25-49">25-49%</option>
                        <option value="1-24">1-24%</option>
                        <option value="0">0%</option>
                      </select>
                    </th>
                    <th>
                      <div className="table-filter-header">Going</div>
                      <select
                        className="table-filter-input"
                        value={tableFilters.going}
                        onChange={(event) => setTableFilters((current) => ({ ...current, going: event.target.value }))}
                      >
                        <option value="all">All</option>
                        <option value="100">100%</option>
                        <option value="75-99">75-99%</option>
                        <option value="50-74">50-74%</option>
                        <option value="25-49">25-49%</option>
                        <option value="1-24">1-24%</option>
                        <option value="0">0%</option>
                      </select>
                    </th>
                    <th>
                      <div className="table-filter-header">Returning</div>
                      <select
                        className="table-filter-input"
                        value={tableFilters.returning}
                        onChange={(event) => setTableFilters((current) => ({ ...current, returning: event.target.value }))}
                      >
                        <option value="all">All</option>
                        <option value="100">100%</option>
                        <option value="75-99">75-99%</option>
                        <option value="50-74">50-74%</option>
                        <option value="25-49">25-49%</option>
                        <option value="1-24">1-24%</option>
                        <option value="0">0%</option>
                      </select>
                    </th>
                    <th>
                      <div className="table-filter-header">Status</div>
                      <select
                        className="table-filter-input"
                        value={tableFilters.status}
                        onChange={(event) => setTableFilters((current) => ({ ...current, status: event.target.value }))}
                      >
                        <option value="all">All</option>
                        <option value="complete">Complete</option>
                        <option value="in-progress">In progress</option>
                        <option value="not-started">Not started</option>
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRouteRows.map((row) => {
                    const goingSummary = row.directionSummary?.['0'] || { ridden: 0, total: 0 };
                    const returningSummary = row.directionSummary?.['1'] || { ridden: 0, total: 0 };

                    return (
                      <tr
                        key={row.id}
                        className={selectedRouteId === row.id ? 'selected-route-row' : ''}
                        onClick={() => handleRouteSelect(row.id)}
                      >
                        <td>{row.shortName || row.name}</td>
                        <td>{ROUTE_TYPE_LABELS[String(row.type)] || `Type ${row.type}`}</td>
                        <td>{row.percent}%</td>
                        <td>{goingSummary.ridden}/{goingSummary.total}</td>
                        <td>{returningSummary.ridden}/{returningSummary.total}</td>
                        <td>{row.complete ? 'Complete' : row.percent > 0 ? 'In progress' : 'Not started'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {transitData && (
          <div className="reset-all-panel">
            <button
              className={`reset-all-button ${resetHoldActive ? 'is-holding' : ''}`}
              onPointerDown={(event) => {
                event.preventDefault();
                beginResetHold();
              }}
              onPointerUp={cancelResetHold}
              onPointerLeave={cancelResetHold}
              onPointerCancel={cancelResetHold}
              onTouchStart={(event) => {
                event.preventDefault();
                beginResetHold();
              }}
              onTouchEnd={cancelResetHold}
              onTouchCancel={cancelResetHold}
              onContextMenu={(event) => event.preventDefault()}
              aria-label="Reset all progress"
            >
              <span>{resetHoldActive ? 'Hold to clear all progress' : 'Reset all progress'}</span>
              <span className="reset-all-hold-bar">
                <span className="reset-all-hold-fill" style={{ width: `${resetHoldProgress}%` }} />
              </span>
            </button>
          </div>
        )}

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
