/**
 * EXIF GPS extractor + OpenStreetMap reverse geocoder
 * No API key required — uses free Nominatim service
 */

const fs = require('fs');

// ── Parse GPS from JPEG EXIF bytes manually (no npm package needed) ──
function parseExifGPS(buffer) {
  try {
    // Find EXIF marker (0xFFE1)
    let offset = 2;
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xE1) {
        const exifLen = buffer.readUInt16BE(offset + 2);
        const exifData = buffer.slice(offset + 4, offset + 2 + exifLen);
        return extractGPSFromExif(exifData);
      }
      if (buffer[offset] === 0xFF) {
        const len = buffer.readUInt16BE(offset + 2);
        offset += 2 + len;
      } else {
        offset++;
      }
    }
  } catch { /* not a JPEG or no EXIF */ }
  return null;
}

function extractGPSFromExif(exif) {
  try {
    // Check "Exif\0\0" header
    const header = exif.slice(0, 6).toString('ascii');
    if (!header.startsWith('Exif')) return null;

    const tiffStart = 6;
    const byteOrder = exif.readUInt16BE(tiffStart);
    const le = byteOrder === 0x4949; // little endian

    function read16(off) { return le ? exif.readUInt16LE(off) : exif.readUInt16BE(off); }
    function read32(off) { return le ? exif.readUInt32LE(off) : exif.readUInt32BE(off); }
    function readRational(off) {
      const num = read32(off);
      const den = read32(off + 4);
      return den ? num / den : 0;
    }

    const ifdOffset = tiffStart + read32(tiffStart + 4);
    const tagCount  = read16(ifdOffset);

    let gpsIFDOffset = null;
    for (let i = 0; i < tagCount; i++) {
      const tagOff = ifdOffset + 2 + i * 12;
      const tag    = read16(tagOff);
      if (tag === 0x8825) { // GPS IFD pointer
        gpsIFDOffset = tiffStart + read32(tagOff + 8);
        break;
      }
    }

    if (!gpsIFDOffset) return null;

    const gpsTagCount = read16(gpsIFDOffset);
    const gpsTags = {};
    for (let i = 0; i < gpsTagCount; i++) {
      const tagOff = gpsIFDOffset + 2 + i * 12;
      const tag    = read16(tagOff);
      const type   = read16(tagOff + 2);
      const count  = read32(tagOff + 4);
      const valOff = tagOff + 8;
      gpsTags[tag] = { type, count, valOff };
    }

    function getGPSValue(tag) {
      const t = gpsTags[tag];
      if (!t) return null;
      if (t.type === 2) { // ASCII
        const off = t.count > 4 ? tiffStart + read32(t.valOff) : t.valOff;
        return exif.slice(off, off + t.count - 1).toString('ascii');
      }
      if (t.type === 5) { // Rational
        const off = tiffStart + read32(t.valOff);
        return [readRational(off), readRational(off + 8), readRational(off + 16)];
      }
      return null;
    }

    const latRef  = getGPSValue(1);  // N/S
    const latDMS  = getGPSValue(2);  // [deg, min, sec]
    const lonRef  = getGPSValue(3);  // E/W
    const lonDMS  = getGPSValue(4);  // [deg, min, sec]
    const altRef  = gpsTags[5];
    const altVal  = getGPSValue(6);  // altitude rational

    if (!latRef || !latDMS || !lonRef || !lonDMS) return null;

    const lat = (latDMS[0] + latDMS[1] / 60 + latDMS[2] / 3600) * (latRef === 'S' ? -1 : 1);
    const lon = (lonDMS[0] + lonDMS[1] / 60 + lonDMS[2] / 3600) * (lonRef === 'W' ? -1 : 1);

    let altitude = null;
    if (altVal !== null && typeof altVal === 'number') {
      altitude = altRef ? (altVal * (altRef.type === 1 ? -1 : 1)) : altVal;
    }

    if (!isFinite(lat) || !isFinite(lon)) return null;
    if (lat === 0 && lon === 0) return null; // (0,0) is invalid GPS

    return { latitude: lat, longitude: lon, altitude_m: altitude };
  } catch { return null; }
}

// ── OpenStreetMap Nominatim reverse geocode (free, no key) ────
async function reverseGeocode(latitude, longitude) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const url   = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=18`;
    const res   = await fetch(url, {
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'FloraIQ/2.0 (floraiq.app)' },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return null;
    const data = await res.json();

    const addr = data.address || {};
    return {
      display_name:  data.display_name || null,
      country:       addr.country || null,
      country_code:  (addr.country_code || '').toUpperCase() || null,
      state:         addr.state || addr.region || null,
      city:          addr.city || addr.town || addr.village || addr.county || null,
      street:        addr.road || addr.street || null,
      postcode:      addr.postcode || null,
      location_name: buildLocationName(addr),
    };
  } catch { return null; }
}

function buildLocationName(addr) {
  const parts = [
    addr.road || addr.street,
    addr.city || addr.town || addr.village || addr.county,
    addr.state || addr.region,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ') || null;
}

// ── Main: extract GPS from image file + geocode ───────────────
async function extractLocation(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const gps    = parseExifGPS(buffer);
    if (!gps) return null;

    const geo = await reverseGeocode(gps.latitude, gps.longitude);
    return { ...gps, ...(geo || {}) };
  } catch { return null; }
}

module.exports = { extractLocation, reverseGeocode };
