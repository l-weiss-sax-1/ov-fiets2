// ovfiets.js

const tja = "964c8281c5ce4e82b00eaaa8c751a002";
const STATIONS_URL = "https://gateway.apiportal.ns.nl/nsapp-stations/v3";
const OVFIETS_URL = "https://gateway.apiportal.ns.nl/places-api/v2/ovfiets";

// Get DOM elements
const searchBtn = document.getElementById('searchBtn');
const stationInput = document.getElementById('stationInput');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');

// Add event listeners
searchBtn.addEventListener('click', handleSearch);
stationInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleSearch();
  }
});

async function handleSearch() {
  const searchQuery = stationInput.value.trim();
  
  if (!searchQuery) {
    showError("Please enter a city or station name");
    return;
  }

  // Clear previous results and errors
  resultsDiv.innerHTML = '';
  errorDiv.innerHTML = '';
  resultsDiv.classList.remove('active');
  errorDiv.classList.remove('active');

  // Show loading state
  resultsDiv.innerHTML = '<div class="loading">Searching for stations...</div>';
  resultsDiv.classList.add('active');

  await searchStations(searchQuery);
}

async function searchStations(query) {
  try {
    const url = `${STATIONS_URL}?q=${encodeURIComponent(query)}&includeNonPlannableStations=false&limit=10`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": tja,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const stations = data?.payload ?? [];

    if (stations.length === 0) {
      showError("No stations found for this search.");
      return;
    }

    // Fetch OV-fiets data for all stations
    await fetchAndDisplayStationsWithBikes(stations);

  } catch (error) {
    showError(`Error searching stations: ${error.message}`);
  }
}

async function fetchAndDisplayStationsWithBikes(stations) {
  resultsDiv.innerHTML = '<div class="loading">Checking bike availability...</div>';
  
  // Fetch bike data for all stations in parallel
  const stationsWithBikes = await Promise.all(
    stations.map(async (station) => {
      const stationCode = station?.id?.code;
      const bikeData = await getOVFietsDataForStation(stationCode);
      return {
        ...station,
        bikeLocations: bikeData
      };
    })
  );

  // Filter out stations without bikes
  const stationsWithAvailableBikes = stationsWithBikes.filter(
    station => station.bikeLocations.length > 0
  );

  if (stationsWithAvailableBikes.length === 0) {
    showError("No OV-fiets available at any of these stations.");
    return;
  }

  displayStationList(stationsWithAvailableBikes);
}

async function getOVFietsDataForStation(stationCode) {
  try {
    const url = `${OVFIETS_URL}?station_code=${stationCode}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": tja,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const locations = data?.payload?.[0]?.locations ?? [];
    
    return locations;

  } catch (error) {
    return [];
  }
}

function displayStationList(stations) {
  resultsDiv.innerHTML = '<h2 class="results-title">Stations with available OV-fiets:</h2>';
  resultsDiv.classList.add('active');

  const stationList = document.createElement('div');
  stationList.className = 'station-list';

  stations.forEach((station) => {
    const stationCode = station?.id?.code;
    const stationName = station?.names?.long ?? "Unknown";
    const stationType = station?.stationType?.replace(/_/g, ' ') ?? "";
    const bikeLocations = station.bikeLocations;

    // Calculate total bikes and check if any location is staffed (bemenst)
    let totalBikes = 0;
    let hasStaffed = false;

    bikeLocations.forEach(loc => {
      const bikes = loc?.extra?.rentalBikes;
      if (bikes !== "Unknown" && !isNaN(bikes)) {
        totalBikes += parseInt(bikes);
      }
      const serviceType = loc?.extra?.serviceType ?? "";
      if (serviceType.toLowerCase().includes("bemenst")) {
        hasStaffed = true;
      }
    });

    const stationCard = document.createElement('div');
    stationCard.className = 'station-card';
    stationCard.onclick = () => displayBikeDetails(bikeLocations, stationName, stationCode);
    
    stationCard.innerHTML = `
      <div class="station-header">
        <div class="station-name">${stationName} ${hasStaffed ? '🪙' : ''}</div>
        <div class="bike-count">${totalBikes} ${totalBikes === 1 ? 'bike' : 'bikes'}</div>
      </div>
      <div class="station-info">
        <span class="station-code">${stationCode}</span>
        <span class="station-type">${stationType}</span>
        ${bikeLocations.length > 1 ? `<span class="location-count">${bikeLocations.length} locations</span>` : ''}
      </div>
    `;

    stationList.appendChild(stationCard);
  });

  resultsDiv.appendChild(stationList);
}

function displayBikeDetails(locations, stationName, stationCode) {
  resultsDiv.innerHTML = `
    <div class="results-header">
      <h2 class="results-title">OV-fiets at ${stationName}</h2>
      <button class="back-btn" onclick="location.reload()">← Search Again</button>
    </div>
  `;
  resultsDiv.classList.add('active');

  locations.forEach((loc, index) => {
    const serviceType = loc?.extra?.serviceType ?? "Unknown";
    const rentalBikes = loc?.extra?.rentalBikes ?? "Unknown";
    const isBemenst = serviceType.toLowerCase().includes("bemenst");

    const locationCard = document.createElement('div');
    locationCard.className = 'location-card';
    
    locationCard.innerHTML = `
      <h3>Location ${index + 1} ${isBemenst ? '🪙' : ''}</h3>
      <div class="info-row">
        <span class="info-label">Service Type:</span>
        <span>${serviceType}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Available Bikes:</span>
        <span class="bikes-available">${rentalBikes}</span>
      </div>
    `;

    resultsDiv.appendChild(locationCard);
  });
}

function showError(message) {
  resultsDiv.innerHTML = '';
  resultsDiv.classList.remove('active');
  errorDiv.innerHTML = message;
  errorDiv.classList.add('active');
}