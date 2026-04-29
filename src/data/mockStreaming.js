// Seeded random for consistent procedural data
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// --- Daily Streaming Data (90 days from 2025-01-15) ---
function generateDailyStreams() {
  const startDate = new Date('2025-01-15');
  const days = 90;
  const baseTotal = 2400000; // 2.4M total daily streams starting point
  const growthRate = 0.35; // 35% growth over 90 days
  const data = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const trend = 1 + growthRate * (i / days);
    const noise = 1 + (seededRandom(i * 7 + 3) - 0.5) * 0.15;
    const totalStreams = Math.round(baseTotal * trend * noise);

    // Platform splits with slight per-day variation
    const spNoise = 0.40 + (seededRandom(i * 13 + 1) - 0.5) * 0.03;
    const apNoise = 0.18 + (seededRandom(i * 17 + 2) - 0.5) * 0.02;
    const ytNoise = 0.28 + (seededRandom(i * 23 + 3) - 0.5) * 0.03;
    const amNoise = 0.08 + (seededRandom(i * 29 + 4) - 0.5) * 0.01;
    const tdNoise = 0.06 + (seededRandom(i * 31 + 5) - 0.5) * 0.01;

    data.push({
      date: dateStr,
      spotify: Math.round(totalStreams * spNoise),
      apple: Math.round(totalStreams * apNoise),
      youtube: Math.round(totalStreams * ytNoise),
      amazon: Math.round(totalStreams * amNoise),
      tidal: Math.round(totalStreams * tdNoise),
    });
  }

  return data;
}

export const dailyStreams = generateDailyStreams();

// --- Top Tracks ---
export const topTracks = [
  { rank: 1, title: 'Midnight Frequency', streams: 184200000, delta: 12.4, peakPosition: 1, weeksOnChart: 18 },
  { rank: 2, title: 'Neon Pulse', streams: 156800000, delta: 8.7, peakPosition: 1, weeksOnChart: 24 },
  { rank: 3, title: 'Glass Cathedral', streams: 132400000, delta: 23.1, peakPosition: 3, weeksOnChart: 9 },
  { rank: 4, title: 'Velvet Thunder', streams: 118900000, delta: 5.2, peakPosition: 2, weeksOnChart: 31 },
  { rank: 5, title: 'Echo Chamber', streams: 97600000, delta: -2.1, peakPosition: 4, weeksOnChart: 14 },
  { rank: 6, title: 'Starlight Drive', streams: 89300000, delta: 41.8, peakPosition: 6, weeksOnChart: 4 },
  { rank: 7, title: 'Digital Rain', streams: 76500000, delta: 3.4, peakPosition: 5, weeksOnChart: 22 },
  { rank: 8, title: 'Aurora', streams: 64200000, delta: 15.6, peakPosition: 7, weeksOnChart: 11 },
  { rank: 9, title: 'Phantom Signal', streams: 52800000, delta: -0.8, peakPosition: 8, weeksOnChart: 16 },
  { rank: 10, title: 'Wild Cards', streams: 41100000, delta: 67.3, peakPosition: 10, weeksOnChart: 2 },
];

// --- Physical Sales ---
export const physicalSales = [
  { format: 'Vinyl', units: 48200, revenue: 1205000 },
  { format: 'CD', units: 23100, revenue: 277200 },
  { format: 'Cassette', units: 8900, revenue: 89000 },
];

// --- Airplay Data ---
export const airplayData = [
  { station: 'BBC Radio 1', spins: 342, reach: 18400000, country: 'UK' },
  { station: 'KROQ', spins: 287, reach: 4200000, country: 'US' },
  { station: 'Triple J', spins: 264, reach: 3100000, country: 'AU' },
  { station: 'SiriusXM Alt Nation', spins: 231, reach: 8900000, country: 'US' },
  { station: 'Radio X', spins: 198, reach: 2800000, country: 'UK' },
  { station: 'NRJ', spins: 176, reach: 12600000, country: 'FR' },
  { station: 'KEXP', spins: 163, reach: 1400000, country: 'US' },
  { station: 'Beats 1 (Apple)', spins: 154, reach: 22000000, country: 'Global' },
  { station: 'Radio Eins', spins: 142, reach: 2100000, country: 'DE' },
  { station: 'FIP', spins: 128, reach: 1800000, country: 'FR' },
  { station: 'CBC Radio 3', spins: 117, reach: 960000, country: 'CA' },
  { station: 'Yle X3M', spins: 104, reach: 740000, country: 'FI' },
  { station: 'FM4', spins: 96, reach: 890000, country: 'AT' },
  { station: 'Radio 3 (Spain)', spins: 88, reach: 1500000, country: 'ES' },
  { station: 'JJJ Unearthed', spins: 73, reach: 620000, country: 'AU' },
];

// --- Geography Data ---
export const geographyData = [
  {
    country: 'United States', streams: 89400000,
    cities: [
      { city: 'Los Angeles', streams: 18200000 },
      { city: 'New York', streams: 16800000 },
      { city: 'Chicago', streams: 9400000 },
      { city: 'Houston', streams: 7100000 },
      { city: 'Miami', streams: 6300000 },
    ],
  },
  {
    country: 'United Kingdom', streams: 42300000,
    cities: [
      { city: 'London', streams: 19800000 },
      { city: 'Manchester', streams: 7200000 },
      { city: 'Birmingham', streams: 4100000 },
      { city: 'Glasgow', streams: 3200000 },
    ],
  },
  {
    country: 'Mexico', streams: 38100000,
    cities: [
      { city: 'Mexico City', streams: 16400000 },
      { city: 'Guadalajara', streams: 8200000 },
      { city: 'Monterrey', streams: 6900000 },
    ],
  },
  {
    country: 'Brazil', streams: 34700000,
    cities: [
      { city: 'São Paulo', streams: 14800000 },
      { city: 'Rio de Janeiro', streams: 8300000 },
      { city: 'Belo Horizonte', streams: 4200000 },
      { city: 'Curitiba', streams: 3100000 },
    ],
  },
  {
    country: 'Germany', streams: 28900000,
    cities: [
      { city: 'Berlin', streams: 11200000 },
      { city: 'Hamburg', streams: 5400000 },
      { city: 'Munich', streams: 4800000 },
    ],
  },
  {
    country: 'France', streams: 22400000,
    cities: [
      { city: 'Paris', streams: 12100000 },
      { city: 'Lyon', streams: 3400000 },
      { city: 'Marseille', streams: 2800000 },
    ],
  },
  {
    country: 'Japan', streams: 19800000,
    cities: [
      { city: 'Tokyo', streams: 9400000 },
      { city: 'Osaka', streams: 4200000 },
      { city: 'Nagoya', streams: 2100000 },
    ],
  },
  {
    country: 'South Korea', streams: 16200000,
    cities: [
      { city: 'Seoul', streams: 10800000 },
      { city: 'Busan', streams: 2400000 },
      { city: 'Incheon', streams: 1600000 },
    ],
  },
  {
    country: 'Australia', streams: 14500000,
    cities: [
      { city: 'Sydney', streams: 5800000 },
      { city: 'Melbourne', streams: 4900000 },
      { city: 'Brisbane', streams: 2100000 },
    ],
  },
  {
    country: 'Nigeria', streams: 11200000,
    cities: [
      { city: 'Lagos', streams: 6400000 },
      { city: 'Abuja', streams: 2100000 },
      { city: 'Port Harcourt', streams: 1200000 },
    ],
  },
];
