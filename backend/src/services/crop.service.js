import logger from '../utils/logger.js';

const cropProfiles = {
  maize: { ndviRange: [4000, 8000], tempRange: [20, 30], rainfallRange: [60, 120], season: [2, 3, 4, 5, 6, 7] },
  wheat: { ndviRange: [3500, 7000], tempRange: [15, 25], rainfallRange: [45, 90], season: [5, 6, 7, 8, 9] },
  beans: { ndviRange: [3000, 6500], tempRange: [18, 28], rainfallRange: [50, 100], season: [2, 3, 4, 9, 10, 11] },
  sorghum: { ndviRange: [2500, 6000], tempRange: [25, 35], rainfallRange: [30, 80], season: [2, 3, 4, 5, 6] },
  millet: { ndviRange: [2000, 5500], tempRange: [25, 35], rainfallRange: [25, 60], season: [3, 4, 5, 6] },
  tea: { ndviRange: [6000, 9000], tempRange: [15, 25], rainfallRange: [100, 200], season: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  coffee: { ndviRange: [5000, 8500], tempRange: [18, 28], rainfallRange: [80, 150], season: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

const regionElevation = {
  Laikipia: { altitude: 1800, soil: 'volcanic_loam', typical: ['wheat', 'maize', 'beans'] },
  Nakuru: { altitude: 1850, soil: 'clay_loam', typical: ['maize', 'wheat', 'beans'] },
  Turkana: { altitude: 500, soil: 'sandy', typical: ['sorghum', 'millet'] },
};

export function classifyCrop(region, { ndvi, temperature, rainfall } = {}) {
  const regionInfo = regionElevation[region] || { altitude: 1000, soil: 'unknown', typical: ['maize'] };
  const month = new Date().getMonth();

  const scores = {};

  for (const [crop, profile] of Object.entries(cropProfiles)) {
    let score = 0;

    // NDVI match
    if (ndvi) {
      const ndviFit = fitScore(ndvi, profile.ndviRange[0], profile.ndviRange[1]);
      score += ndviFit * 30;
    }

    // Temperature match
    if (temperature) {
      const tempFit = fitScore(temperature, profile.tempRange[0], profile.tempRange[1]);
      score += tempFit * 25;
    }

    // Rainfall match
    if (rainfall) {
      const rainFit = fitScore(rainfall, profile.rainfallRange[0], profile.rainfallRange[1]);
      score += rainFit * 20;
    }

    // Season match
    if (profile.season.includes(month)) {
      score += 15;
    }

    // Regional typical crop bonus
    if (regionInfo.typical.includes(crop)) {
      score += 10;
    }

    scores[crop] = Math.round(score);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topCrop = sorted[0];
  const totalScore = sorted.reduce((s, [, v]) => s + v, 0);

  const result = {
    region,
    primaryCrop: topCrop[0],
    confidence: topCrop[1] >= 70 ? 'high' : topCrop[1] >= 45 ? 'medium' : 'low',
    rankings: sorted.map(([crop, score]) => ({
      crop,
      score,
      probability: totalScore > 0 ? Math.round((score / totalScore) * 100) : 0,
    })).slice(0, 5),
    regionInfo: {
      altitude: regionInfo.altitude,
      soil: regionInfo.soil,
      typicalCrops: regionInfo.typical,
    },
    currentMonth: month + 1,
    input: { ndvi, temperature, rainfall },
  };

  logger.info(`Crop classification ${region}: ${result.primaryCrop} (${topCrop[1]}/100)`);
  return result;
}

export function getRecommendations(region) {
  const info = regionElevation[region];
  if (!info) return { region, recommendations: ['Data not available for this region'] };

  const month = new Date().getMonth();
  const recommendations = [];

  for (const crop of info.typical) {
    const profile = cropProfiles[crop];
    if (profile && profile.season.includes(month)) {
      recommendations.push({
        crop,
        status: 'in_season',
        optimalRainfall: profile.rainfallRange,
        optimalTemp: profile.tempRange,
      });
    }
  }

  return { region, soil: info.soil, altitude: info.altitude, recommendations };
}

function fitScore(value, min, max) {
  if (value >= min && value <= max) return 1;
  const mid = (min + max) / 2;
  const range = max - min;
  const distance = Math.abs(value - mid);
  return Math.max(0, 1 - (distance / range));
}
