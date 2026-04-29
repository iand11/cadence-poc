// Seeded random for consistent procedural data
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// --- Stream Forecast (60 actual + 30 forecast) ---
function generateStreamForecast() {
  const startDate = new Date('2025-01-15');
  const totalDays = 90;
  const actualDays = 60;
  const baseStreams = 2400000;
  const growthRate = 0.35;
  const data = [];

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const trend = 1 + growthRate * (i / totalDays);
    const noise = 1 + (seededRandom(i * 7 + 3) - 0.5) * 0.15;
    const value = Math.round(baseStreams * trend * noise);

    if (i < actualDays) {
      // Actual data — solid line
      data.push({
        date: dateStr,
        actual: value,
        forecast: null,
        upper: null,
        lower: null,
      });
    } else {
      // Forecast data — prediction with confidence band
      const forecastBase = Math.round(baseStreams * trend);
      const forecastNoise = 1 + (seededRandom(i * 19 + 41) - 0.5) * 0.08;
      const forecastValue = Math.round(forecastBase * forecastNoise);
      const daysBeyond = i - actualDays;
      const bandWidth = 0.06 + daysBeyond * 0.008; // confidence band widens over time

      data.push({
        date: dateStr,
        actual: null,
        forecast: forecastValue,
        upper: Math.round(forecastValue * (1 + bandWidth)),
        lower: Math.round(forecastValue * (1 - bandWidth)),
      });
    }
  }

  return data;
}

export const streamForecast = generateStreamForecast();

// --- Tour Recommendations ---
export const tourRecommendations = [
  {
    city: 'Mexico City',
    score: 94,
    streamGrowth: 67,
    socialBuzz: 89,
    venueCapacity: '3,000 - 5,000',
    estimatedRevenue: 285000,
    reasoning: 'Streaming up 67% in 90 days. TikTok sound uses surging in MX market. Three viral moments originated from Mexican creators. Strong radio pickup on Ibero 90.9.',
  },
  {
    city: 'São Paulo',
    score: 91,
    streamGrowth: 54,
    socialBuzz: 82,
    venueCapacity: '3,000 - 5,000',
    estimatedRevenue: 248000,
    reasoning: 'Brazil is the fastest-growing market by percentage. "Glass Cathedral" entered Spotify Brazil Viral 50. Strong crossover with Brazilian alt-pop scene.',
  },
  {
    city: 'London',
    score: 88,
    streamGrowth: 28,
    socialBuzz: 76,
    venueCapacity: '5,000 - 8,000',
    estimatedRevenue: 520000,
    reasoning: 'BBC Radio 1 has Luna Vega in heavy rotation (342 spins). Brixton show sold out in 11 minutes — clear demand for a venue upgrade to O2 Academy.',
  },
  {
    city: 'Berlin',
    score: 85,
    streamGrowth: 31,
    socialBuzz: 71,
    venueCapacity: '3,000 - 5,000',
    estimatedRevenue: 310000,
    reasoning: 'Germany is the #5 streaming market. Strong editorial support from Spotify DACH. Columbiahalle show trending toward sellout — could upsize.',
  },
  {
    city: 'Tokyo',
    score: 83,
    streamGrowth: 42,
    socialBuzz: 68,
    venueCapacity: '1,500 - 3,000',
    estimatedRevenue: 195000,
    reasoning: '"Neon Pulse" added to Spotify Japan Hot Hits. Growing TikTok presence in JP market. Alt-pop gaining significant traction with 18-24 demographic.',
  },
  {
    city: 'Seoul',
    score: 81,
    streamGrowth: 38,
    socialBuzz: 74,
    venueCapacity: '2,000 - 3,000',
    estimatedRevenue: 178000,
    reasoning: 'K-pop crossover audience discovering Luna Vega through algorithmic playlists. High save rate (6.1%) in South Korea suggests strong fan conversion.',
  },
  {
    city: 'Lagos',
    score: 78,
    streamGrowth: 89,
    socialBuzz: 62,
    venueCapacity: '1,500 - 3,000',
    estimatedRevenue: 124000,
    reasoning: 'Highest growth rate of any market at 89%. Afrobeats crossover potential. "Velvet Thunder" remix getting unofficial club play. Emerging market opportunity.',
  },
  {
    city: 'Mumbai',
    score: 75,
    streamGrowth: 72,
    socialBuzz: 58,
    venueCapacity: '1,500 - 2,500',
    estimatedRevenue: 108000,
    reasoning: 'India streaming market exploding. Instagram Reels driving discovery. Partnership opportunity with local indie labels. High engagement rate on translated content.',
  },
];
