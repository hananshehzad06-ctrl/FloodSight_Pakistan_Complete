export const MOCK_PAYLOADS = [
  {
    uc_id: "SD-BDN-BADIN1",
    uc_name: "Badin-1",
    district: "Badin",
    hz_lvl: 4,
    bounds: [[24.680, 68.800], [24.680, 68.875], [24.630, 68.875], [24.630, 68.800]],
    boats: [[24.651, 68.834], [24.642, 68.852]],
    hazards: [
      { c: "PWR", desc: "Submerged 11kV Grid Station", pt: [24.657, 68.841] },
      { c: "RD_CUT", desc: "Main Canal Bridge Washout", pt: [24.638, 68.818] }
    ]
  },
  {
    uc_id: "SD-BDN-SEERANI",
    uc_name: "Seerani",
    district: "Badin",
    hz_lvl: 5,
    bounds: [[24.435, 68.950], [24.435, 69.030], [24.370, 69.030], [24.370, 68.950]],
    boats: [[24.401, 68.981], [24.386, 69.005]],
    hazards: [
      { c: "PWR", desc: "Downed Transmission Line Near Feeder Station", pt: [24.407, 68.990] },
      { c: "RD_CUT", desc: "Seerani-Badin Link Road Submerged", pt: [24.379, 68.969] }
    ]
  },
  {
    uc_id: "KP-SWT-KHWAZAKHELA",
    uc_name: "Khwazakhela",
    district: "Swat",
    hz_lvl: 5,
    bounds: [[35.180, 72.445], [35.180, 72.520], [35.120, 72.520], [35.120, 72.445]],
    boats: [[35.151, 72.486], [35.143, 72.473]],
    hazards: [
      { c: "BRG", desc: "Khwazakhela Suspension Bridge Structurally Compromised", pt: [35.148, 72.491] },
      { c: "RD_CUT", desc: "N-45 Approach Road Landslide Blockage", pt: [35.154, 72.481] }
    ]
  },
  {
    uc_id: "KP-SWT-BAHRAIN",
    uc_name: "Bahrain",
    district: "Swat",
    hz_lvl: 5,
    bounds: [[35.245, 72.510], [35.245, 72.585], [35.175, 72.585], [35.175, 72.510]],
    boats: [[35.208, 72.547], [35.199, 72.538]],
    hazards: [
      { c: "BRG", desc: "Bahrain Main Bridge Partial Collapse", pt: [35.207, 72.548] },
      { c: "RD_CUT", desc: "Swat River Road Washout Near Bahrain Bazaar", pt: [35.194, 72.531] }
    ]
  }
];

export const MOCK_UNION_COUNCILS = [
  { id: "uc-01", name: "Seerani", district: "Badin", province: "Sindh", level: "LVL 5", hazards: 2, boats: 2, inundated_km2: 33.8, displaced_pop: 8500, lat: 24.3411, lng: 68.8353 },
  { id: "uc-02", name: "Tando Ghulam Ali", district: "Badin", province: "Sindh", level: "LVL 5", hazards: 3, boats: 3, inundated_km2: 41.6, displaced_pop: 11200, lat: 24.7587, lng: 68.8145 },
  { id: "uc-03", name: "Sadhuri", district: "Sukkur", province: "Sindh", level: "LVL 4", hazards: 2, boats: 2, inundated_km2: 27.4, displaced_pop: 6900, lat: 27.7028, lng: 68.8574 },
  { id: "uc-04", name: "Mingora", district: "Swat", province: "Khyber Pakhtunkhwa", level: "LVL 5", hazards: 4, boats: 1, inundated_km2: 18.9, displaced_pop: 9800, lat: 34.7717, lng: 72.3602 },
  { id: "uc-05", name: "Kabal", district: "Swat", province: "Khyber Pakhtunkhwa", level: "LVL 4", hazards: 3, boats: 1, inundated_km2: 14.7, displaced_pop: 6200, lat: 34.5967, lng: 72.2825 },
  { id: "uc-06", name: "Prang", district: "Charsadda", province: "Khyber Pakhtunkhwa", level: "LVL 5", hazards: 4, boats: 3, inundated_km2: 36.2, displaced_pop: 12400, lat: 34.1547, lng: 71.7649 },
  { id: "uc-07", name: "Kot Chhutta", district: "Dera Ghazi Khan", province: "Punjab", level: "LVL 5", hazards: 3, boats: 2, inundated_km2: 29.8, displaced_pop: 10100, lat: 30.0324, lng: 70.6408 },
  { id: "uc-08", name: "Jampur", district: "Rajanpur", province: "Punjab", level: "LVL 5", hazards: 4, boats: 3, inundated_km2: 44.1, displaced_pop: 15700, lat: 29.6429, lng: 70.5954 },
  { id: "uc-09", name: "Dera Allah Yar", district: "Jaffarabad", province: "Balochistan", level: "LVL 5", hazards: 4, boats: 4, inundated_km2: 52.7, displaced_pop: 18900, lat: 28.3735, lng: 68.3508 },
  { id: "uc-10", name: "Sohbatpur", district: "Sohbatpur", province: "Balochistan", level: "LVL 5", hazards: 4, boats: 3, inundated_km2: 48.5, displaced_pop: 17300, lat: 28.5206, lng: 68.5421 }
];

export const totalInundatedArea = Number(
  MOCK_UNION_COUNCILS.reduce((total, uc) => total + uc.inundated_km2, 0).toFixed(1)
);
export const totalDisplacedPop = MOCK_UNION_COUNCILS.reduce(
  (total, uc) => total + uc.displaced_pop,
  0
);
export const totalBoats = MOCK_UNION_COUNCILS.reduce(
  (total, uc) => total + uc.boats,
  0
);

export const MOCK_SITREP_DATA = {
  inundated_sq_km: totalInundatedArea,
  displaced_pop: totalDisplacedPop,
  active_boats: totalBoats,
  relief_camps_needed: 6,
  last_updated: "2026-08-29 15:30 PKT"
};
