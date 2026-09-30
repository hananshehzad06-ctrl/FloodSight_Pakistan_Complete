import floodAssessmentData from "../data/floodAssessmentData.js";

export async function fetchFloodAssessment() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return floodAssessmentData;
}
