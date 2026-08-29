import type { Airport } from './types';

export const AIRPORTS: Airport[] = [
  { code: 'DEL', city: 'Delhi', state: 'Delhi', lat: 28.5562, lng: 77.1, region: 'North' },
  { code: 'BOM', city: 'Mumbai', state: 'Maharashtra', lat: 19.0896, lng: 72.8656, region: 'West' },
  { code: 'BLR', city: 'Bengaluru', state: 'Karnataka', lat: 13.1986, lng: 77.7069, region: 'South' },
  { code: 'MAA', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9941, lng: 80.1709, region: 'South' },
  { code: 'HYD', city: 'Hyderabad', state: 'Telangana', lat: 17.2403, lng: 78.4294, region: 'South' },
  { code: 'CCU', city: 'Kolkata', state: 'West Bengal', lat: 22.6547, lng: 88.4467, region: 'East' },
  { code: 'PNQ', city: 'Pune', state: 'Maharashtra', lat: 18.5793, lng: 73.9089, region: 'West' },
  { code: 'AMD', city: 'Ahmedabad', state: 'Gujarat', lat: 23.0772, lng: 72.6347, region: 'West' },
  { code: 'COK', city: 'Kochi', state: 'Kerala', lat: 10.152, lng: 76.4019, region: 'South' },
  { code: 'GOI', city: 'Goa', state: 'Goa', lat: 15.3808, lng: 73.8314, region: 'West' },
  { code: 'GAU', city: 'Guwahati', state: 'Assam', lat: 26.1061, lng: 91.5859, region: 'North-East' },
  { code: 'JAI', city: 'Jaipur', state: 'Rajasthan', lat: 26.8242, lng: 75.8122, region: 'North' },
  { code: 'LKO', city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.7606, lng: 80.8893, region: 'Central' },
  { code: 'IXC', city: 'Chandigarh', state: 'Punjab', lat: 30.6735, lng: 76.7825, region: 'North' },
  { code: 'IXB', city: 'Bagdogra', state: 'West Bengal', lat: 26.6812, lng: 88.3286, region: 'East' },
  { code: 'VNS', city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.4525, lng: 82.8593, region: 'Central' },
];

export const AIRPORT_MAP: Record<string, Airport> = Object.fromEntries(
  AIRPORTS.map((a) => [a.code, a]),
);
