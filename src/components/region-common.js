import * as Utils from 'src/libs/utils'

// Get a { flag: ..., countryName: ... } object representing a google locationType/location input.
// 'flag' will always be defined (even if it's a question mark.
// 'regionDescription' is the same as location when locationType is 'multi-region', or a country name when locationType is 'region'.
// computeZone is generally the 'a' zone for each region, except for those regions where it is not available.
// The choice to use the 'a' zone is arbitrary, choosing 'b' zone would also work.
// The region choice for multi-region locations is arbitrary as well.
export const unknownRegionFlag = '❓'
export const regionInfo = (location, locationType) => {
  const regionDescription = `${locationType}: ${location}`
  return Utils.switchCase(locationType,
    ['multi-region', () => Utils.switchCase(location,
      ['US', () => ({ flag: '🇺🇸', regionDescription: regionDescription, computeZone: 'us-central1-a', computeRegion: 'us-central1' })],
      ['EU', () => ({ flag: '🇪🇺', regionDescription: regionDescription, computeZone: 'europe-central2-a', computeRegion: 'europe-central2' })],
      ['ASIA', () => ({ flag: '🌏', regionDescription: regionDescription, computeZone: 'asia-east1-a', computeRegion: 'asia-east1' })],
      [Utils.DEFAULT, () => ({ flag: unknownRegionFlag, regionDescription: regionDescription, computeZone: 'UNKNOWN', computeRegion: 'UNKNOWN' })]
    )],
    ['region', () => Utils.switchCase(location,
      ['ASIA-EAST1', () => ({ flag: '🇹🇼', regionDescription: `${regionDescription} (Taiwan)`, computeZone: 'asia-east1-a', computeRegion: 'asia-east1' })],
      ['ASIA-EAST2', () => ({ flag: '🇭🇰', regionDescription: `${regionDescription} (Hong Kong)`, computeZone: 'asia-east2-a', computeRegion: 'asia-east2' })],
      ['ASIA-NORTHEAST1', () => ({ flag: '🇯🇵', regionDescription: `${regionDescription} (Tokyo)`, computeZone: 'asia-northeast1-a', computeRegion: 'asia-northeast1' })],
      ['ASIA-NORTHEAST2', () => ({ flag: '🇯🇵', regionDescription: `${regionDescription} (Osaka)`, computeZone: 'asia-northeast2-a', computeRegion: 'asia-northeast2' })],
      ['ASIA-NORTHEAST3', () => ({ flag: '🇰🇷', regionDescription: `${regionDescription} (Seoul)`, computeZone: 'asia-northeast3-a', computeRegion: 'asia-northeast3' })],
      ['ASIA-SOUTH1', () => ({ flag: '🇮🇳', regionDescription: `${regionDescription} (Mumbai)`, computeZone: 'asia-south1-a', computeRegion: 'asia-south1' })],
      ['ASIA-SOUTHEAST1', () => ({ flag: '🇸🇬', regionDescription: `${regionDescription} (Singapore)`, computeZone: 'asia-southeast1-a', computeRegion: 'asia-southeast1' })],
      ['ASIA-SOUTHEAST2', () => ({ flag: '🇮🇩', regionDescription: `${regionDescription} (Jakarta)`, computeZone: 'asia-southeast2-a', computeRegion: 'asia-southeast2' })],
      ['AUSTRALIA-SOUTHEAST1', () => ({ flag: '🇦🇺', regionDescription: `${regionDescription} (Sydney)`, computeZone: 'australia-southeast1-a', computeRegion: 'australia-southeast1' })],
      ['EUROPE-NORTH1', () => ({ flag: '🇫🇮', regionDescription: `${regionDescription} (Finland)`, computeZone: 'europe-north1-a', computeRegion: 'europe-north1' })],
      ['EUROPE-WEST1', () => ({ flag: '🇧🇪', regionDescription: `${regionDescription} (Belgium)`, computeZone: 'europe-west1-b', computeRegion: 'europe-west1' })],
      ['EUROPE-WEST2', () => ({ flag: '🇬🇧', regionDescription: `${regionDescription} (London)`, computeZone: 'europe-west2-a', computeRegion: 'europe-west2' })],
      ['EUROPE-WEST3', () => ({ flag: '🇩🇪', regionDescription: `${regionDescription} (Frankfurt)`, computeZone: 'europe-west3-a', computeRegion: 'europe-west3' })],
      ['EUROPE-WEST4', () => ({ flag: '🇳🇱', regionDescription: `${regionDescription} (Netherlands)`, computeZone: 'europe-west4-a', computeRegion: 'europe-west4' })],
      ['EUROPE-WEST6', () => ({ flag: '🇨🇭', regionDescription: `${regionDescription} (Zurich)`, computeZone: 'europe-west6-a', computeRegion: 'europe-west6' })],
      ['NORTHAMERICA-NORTHEAST1', () => ({ flag: '🇨🇦', regionDescription: `${regionDescription} (Montreal)`, computeZone: 'northamerica-northeast1-a', computeRegion: 'northamerica-northeast1' })],
      ['SOUTHAMERICA-EAST1', () => ({ flag: '🇧🇷', regionDescription: `${regionDescription} (Sao Paulo)`, computeZone: 'southamerica-east1-a', computeRegion: 'southamerica-east1' })],
      ['US-CENTRAL1', () => ({ flag: '🇺🇸', regionDescription: `${regionDescription} (Iowa)`, computeZone: 'us-central1-a', computeRegion: 'us-central1' })],
      ['US-EAST1', () => ({ flag: '🇺🇸', regionDescription: `${regionDescription} (South Carolina)`, computeZone: 'us-east1-b', computeRegion: 'us-east1' })],
      ['US-EAST4', () => ({ flag: '🇺🇸', regionDescription: `${regionDescription} (Northern Virginia)`, computeZone: 'us-east4-a', computeRegion: 'us-east4' })],
      ['US-WEST1', () => ({ flag: '🇺🇸', regionDescription: `${regionDescription} (Oregon)`, computeZone: 'us-west1-a', computeRegion: 'us-west1' })],
      ['US-WEST2', () => ({ flag: '🇺🇸', regionDescription: `${regionDescription} (Los Angeles)`, computeZone: 'us-west2-a', computeRegion: 'us-west2' })],
      ['US-WEST3', () => ({ flag: '🇺🇸', regionDescription: `${regionDescription} (Salt Lake City)`, computeZone: 'us-west3-a', computeRegion: 'us-west3' })],
      ['US-WEST4', () => ({ flag: '🇺🇸', regionDescription: `${regionDescription} (Las Vegas)`, computeZone: 'us-west4-a', computeRegion: 'us-west4' })],
      [Utils.DEFAULT, () => ({ flag: unknownRegionFlag, regionDescription: regionDescription, computeZone: 'UNKNOWN', computeRegion: 'UNKNOWN' })]
    )],
    [Utils.DEFAULT, () => ({ flag: unknownRegionFlag, regionDescription: regionDescription, computeZone: 'UNKNOWN', computeRegion: 'UNKNOWN' })]
  )
}
