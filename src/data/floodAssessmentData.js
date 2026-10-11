export const floodAssessmentData = {
  Badin: {
    center: [24.6559, 68.8383],
    zoom: 10,
    metrics: {
      inundatedArea: "17,304 km²",
      displacedPopulation: "2,200,000",
      activeBoats: "1,500",
      campsNeeded: "2,093",
    },
    unionCouncils: [
      { name: "Badin UC-1 (City)", district: "Badin", risk: "LVL 5", hazards: 12, boats: 45 },
      { name: "Tando Bago UC-14", district: "Badin", risk: "LVL 5", hazards: 11, boats: 38 },
      { name: "Matli UC-22", district: "Badin", risk: "LVL 4", hazards: 9, boats: 30 },
      { name: "Shaheed Fazal Rahu UC-31", district: "Badin", risk: "LVL 4", hazards: 8, boats: 25 },
      { name: "Talhar UC-39", district: "Badin", risk: "LVL 3", hazards: 6, boats: 18 },
    ],
  },
  Swat: {
    center: [35.2227, 72.4258],
    zoom: 10,
    metrics: {
      inundatedArea: "4,120 km²",
      displacedPopulation: "450,000",
      activeBoats: "320",
      campsNeeded: "410",
    },
    unionCouncils: [
      { name: "Mingora UC-4", district: "Swat", risk: "LVL 5", hazards: 14, boats: 20 },
      { name: "Kabal UC-12", district: "Swat", risk: "LVL 4", hazards: 10, boats: 15 },
      { name: "Bahrain UC-8", district: "Swat", risk: "LVL 5", hazards: 16, boats: 22 },
      { name: "Matta UC-19", district: "Swat", risk: "LVL 3", hazards: 7, boats: 12 },
      { name: "Barikot UC-2", district: "Swat", risk: "LVL 3", hazards: 5, boats: 10 },
    ],
  },
  "Rahim Yar Khan": {
    center: [28.4212, 70.2989],
    zoom: 10,
    metrics: {
      inundatedArea: "11,850 km²",
      displacedPopulation: "1,100,000",
      activeBoats: "850",
      campsNeeded: "1,120",
    },
    unionCouncils: [
      { name: "Bhong UC-15", district: "Rahim Yar Khan", risk: "LVL 5", hazards: 13, boats: 32 },
      { name: "Chachran UC-8", district: "Rahim Yar Khan", risk: "LVL 5", hazards: 15, boats: 36 },
      { name: "Sadiqabad UC-21", district: "Rahim Yar Khan", risk: "LVL 4", hazards: 9, boats: 24 },
      { name: "Khanpur UC-11", district: "Rahim Yar Khan", risk: "LVL 4", hazards: 8, boats: 20 },
      { name: "Zahirpir UC-5", district: "Rahim Yar Khan", risk: "LVL 3", hazards: 6, boats: 14 },
    ],
  },
  Muzaffargarh: {
    center: [30.0703, 71.1933],
    zoom: 10,
    metrics: {
      inundatedArea: "9,430 km²",
      displacedPopulation: "890,000",
      activeBoats: "640",
      campsNeeded: "880",
    },
    unionCouncils: [
      { name: "Lati Mari UC-3", district: "Muzaffargarh", risk: "LVL 5", hazards: 17, boats: 40 },
      { name: "Alipur UC-12", district: "Muzaffargarh", risk: "LVL 5", hazards: 14, boats: 35 },
      { name: "Kot Addu UC-7", district: "Muzaffargarh", risk: "LVL 4", hazards: 11, boats: 28 },
      { name: "Jatoi UC-19", district: "Muzaffargarh", risk: "LVL 4", hazards: 9, boats: 22 },
      { name: "Rohillanwali UC-2", district: "Muzaffargarh", risk: "LVL 3", hazards: 5, boats: 12 },
    ],
  },
};

export default floodAssessmentData;
