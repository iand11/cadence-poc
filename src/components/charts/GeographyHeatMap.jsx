import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';
import { getCityCoords } from '../../data/cityCoords';
import { formatNumber } from '../../utils/formatters';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

// ISO alpha-2 → ISO 3166-1 numeric (for countries that appear in our data)
const ALPHA2_TO_NUMERIC = {
  US: '840', GB: '826', CA: '124', AU: '036', DE: '276', FR: '250',
  BR: '076', MX: '484', JP: '392', KR: '410', IN: '356', ID: '360',
  PH: '608', TH: '764', IT: '380', ES: '724', NL: '528', SE: '752',
  NO: '578', DK: '208', FI: '246', PL: '616', TR: '792', AR: '032',
  CL: '152', CO: '170', PE: '604', ZA: '710', NZ: '554', IE: '372',
  PT: '620', AT: '040', CH: '756', BE: '056', RU: '643', UA: '804',
  TW: '158', SG: '702', MY: '458', VN: '704', NG: '566', EG: '818',
  SA: '682', AE: '784', IL: '376', CZ: '203', RO: '642', HU: '348',
  GR: '300', HR: '191', PR: '630', DO: '214', GT: '320', EC: '218',
  VE: '862', PK: '586', BD: '050', LK: '144', KE: '404', GH: '288',
  TZ: '834', HK: '344',
};

const worldGeo = feature(worldTopo, worldTopo.objects.countries);

function CountryLayer({ countryListeners, maxListeners }) {
  const geoRef = useRef();

  const style = (feat) => {
    const count = countryListeners[feat.id] || 0;
    if (count === 0) {
      return {
        fillColor: '#1E1E1E',
        fillOpacity: 0.3,
        color: '#2A2A2A',
        weight: 0.5,
      };
    }
    const ratio = count / maxListeners;
    // Interpolate from dim amber to bright amber
    const opacity = 0.15 + ratio * 0.7;
    return {
      fillColor: '#00D4FF',
      fillOpacity: opacity,
      color: '#00D4FF',
      weight: ratio > 0.5 ? 1.5 : 0.8,
      opacity: 0.4 + ratio * 0.4,
    };
  };

  const onEachFeature = (feat, layer) => {
    const count = countryListeners[feat.id] || 0;
    if (count > 0) {
      layer.bindTooltip(
        `<div style="font-family: 'Inter', sans-serif; font-size: 12px;">
          <strong>${feat.properties.name}</strong><br/>
          ${formatNumber(count)} listeners
        </div>`,
        { className: 'leaflet-dark-tooltip', sticky: true }
      );
      layer.on({
        mouseover: (e) => {
          e.target.setStyle({ fillOpacity: 0.9, weight: 2 });
        },
        mouseout: () => {
          geoRef.current?.resetStyle();
        },
      });
    }
  };

  return (
    <GeoJSON
      ref={geoRef}
      data={worldGeo}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

export default function GeographyHeatMap({ data }) {
  // data: [{ city, country, listeners }]

  // Aggregate listeners by country (numeric ID for matching world-atlas features)
  const { countryListeners, maxListeners } = useMemo(() => {
    const byCountry = {};
    data.forEach(d => {
      const numericId = ALPHA2_TO_NUMERIC[d.country];
      if (!numericId) return;
      byCountry[numericId] = (byCountry[numericId] || 0) + d.listeners;
    });
    const max = Math.max(1, ...Object.values(byCountry));
    return { countryListeners: byCountry, maxListeners: max };
  }, [data]);

  // City markers for detail
  const markers = useMemo(() =>
    data
      .map(d => {
        const coords = getCityCoords(d.city);
        if (!coords) return null;
        return { ...d, lat: coords[0], lng: coords[1] };
      })
      .filter(Boolean),
  [data]);

  const maxCityListeners = Math.max(1, ...markers.map(m => m.listeners));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[340px] text-sm text-[#444444]">
        No geographic data available
      </div>
    );
  }

  return (
    <div className="rounded overflow-hidden border border-[#1E1E1E]" style={{ height: 340 }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', background: '#080808' }}
        attributionControl={false}
      >
        <TileLayer url={TILE_URL} />
        <CountryLayer countryListeners={countryListeners} maxListeners={maxListeners} />
        {markers.map((m) => {
          const ratio = m.listeners / maxCityListeners;
          return (
            <CircleMarker
              key={`${m.city}-${m.country}`}
              center={[m.lat, m.lng]}
              radius={4 + ratio * 10}
              pathOptions={{
                color: '#fff',
                fillColor: '#00D4FF',
                fillOpacity: 0.7 + ratio * 0.3,
                weight: 1,
                opacity: 0.6,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -(4 + ratio * 10)]}
                className="leaflet-dark-tooltip"
              >
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
                  <strong>{m.city}</strong>
                  <br />
                  {formatNumber(m.listeners)} listeners
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
