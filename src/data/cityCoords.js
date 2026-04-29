// Lat/lng for cities that appear in Spotify's "where people listen" data
const CITY_COORDS = {
  'Bandung': [-6.9175, 107.6191],
  'Bangkok': [13.7563, 100.5018],
  'Bengaluru': [12.9716, 77.5946],
  'Berlin': [52.5200, 13.4050],
  'Bogotá': [4.7110, -74.0721],
  'Brisbane': [-27.4698, 153.0251],
  'Chennai': [13.0827, 80.2707],
  'Chicago': [41.8781, -87.6298],
  'Dallas': [32.7767, -96.7970],
  'Delhi': [28.7041, 77.1025],
  'Frankfurt am Main': [50.1109, 8.6821],
  'Guadalajara': [20.6597, -103.3496],
  'Hyderabad': [17.3850, 78.4867],
  'Istanbul': [41.0082, 28.9784],
  'Jakarta': [-6.2088, 106.8456],
  'Kuala Lumpur': [3.1390, 101.6869],
  'Lagos': [6.5244, 3.3792],
  'Lima': [-12.0464, -77.0428],
  'London': [51.5074, -0.1278],
  'Los Angeles': [34.0522, -118.2437],
  'Madrid': [40.4168, -3.7038],
  'Manchester': [53.4808, -2.2426],
  'Manila': [14.5995, 120.9842],
  'Medellín': [6.2442, -75.5812],
  'Melbourne': [-37.8136, 144.9631],
  'Mexico City': [19.4326, -99.1332],
  'Monterrey': [25.6866, -100.3161],
  'Mumbai': [19.0760, 72.8777],
  'New Delhi': [28.6139, 77.2090],
  'New York City': [40.7128, -74.0060],
  'Port Harcourt': [4.8156, 7.0498],
  'Puebla City': [19.0414, -98.2063],
  'Pune': [18.5204, 73.8567],
  'Quezon City': [14.6760, 121.0437],
  'Santiago': [-33.4489, -70.6693],
  'Surabaya': [-7.2575, 112.7521],
  'Sydney': [-33.8688, 151.2093],
  'São Paulo': [-23.5505, -46.6333],
  'Toronto': [43.6532, -79.3832],
};

export function getCityCoords(cityName) {
  return CITY_COORDS[cityName] || null;
}

export default CITY_COORDS;
