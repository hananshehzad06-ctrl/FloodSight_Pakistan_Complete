const floodAssessmentData = {
  timestamp: "2026-09-30T17:15:00+05:00",
  macro_summary: {
    inundated_area_km2: 17304.0,
    displaced_population: 2200000,
    active_boats: 1500,
    relief_camps: 2093,
  },
  pinned_hotspots: [
    { name: "Badin", lat: 24.656, long: 68.837 },
    { name: "Swat", lat: 35.2, long: 72.45 },
    { name: "Rahim Yar Khan", lat: 28.42, long: 70.295 },
    { name: "Muzaffargarh", lat: 30.07, long: 71.194 },
  ],
  priority_risk_ranking: [
    { uc_name: "Badin UC-1 (City)", district: "Badin", risk_level: "LVL 5", hazard_count: 12, recommended_boats: 45 },
    { uc_name: "Tando Bago UC-14", district: "Badin", risk_level: "LVL 5", hazard_count: 11, recommended_boats: 38 },
    { uc_name: "Matli UC-22", district: "Badin", risk_level: "LVL 4", hazard_count: 9, recommended_boats: 30 },
    { uc_name: "Shaheed Fazal Rahu UC-31", district: "Badin", risk_level: "LVL 4", hazard_count: 8, recommended_boats: 25 },
    { uc_name: "Talhar UC-39", district: "Badin", risk_level: "LVL 3", hazard_count: 6, recommended_boats: 18 },
    { uc_name: "Swat UC-5 (Mingora)", district: "Swat", risk_level: "LVL 5", hazard_count: 10, recommended_boats: 35 },
    { uc_name: "Charbagh UC-12", district: "Swat", risk_level: "LVL 4", hazard_count: 8, recommended_boats: 28 },
    { uc_name: "Kabal UC-19", district: "Swat", risk_level: "LVL 4", hazard_count: 7, recommended_boats: 22 },
    { uc_name: "Barikot UC-26", district: "Swat", risk_level: "LVL 3", hazard_count: 5, recommended_boats: 15 },
    { uc_name: "Jalalpur Pirwala UC-8", district: "Rahim Yar Khan", risk_level: "LVL 5", hazard_count: 13, recommended_boats: 50 },
  ],
};

export default floodAssessmentData;
