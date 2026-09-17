/**
 * TASKFLOW SAAS - LIVE ROI & TIME SAVINGS CALCULATOR (REST API CONNECTED)
 */

class RoiCalculator {
  constructor() {
    this.teamSlider = document.getElementById('roiSliderTeam');
    this.hoursSlider = document.getElementById('roiSliderHours');

    if (!this.teamSlider || !this.hoursSlider) return;

    this.sliderTeamText = document.getElementById('sliderTeamText');
    this.sliderHoursText = document.getElementById('sliderHoursText');

    this.roiAnnualVal = document.getElementById('roiAnnualVal');
    this.roiHoursVal = document.getElementById('roiHoursVal');

    this.debounceTimer = null;
    this.init();
  }

  init() {
    [this.teamSlider, this.hoursSlider].forEach(slider => {
      slider.addEventListener('input', () => {
        this.updateBadges();
        this.scheduleBackendCalc();
      });
    });
    this.updateBadges();
    this.calculateBackend();
  }

  getValidatedInputs() {
    let teamSize = parseInt(this.teamSlider.value, 10);
    let hoursSaved = parseInt(this.hoursSlider.value, 10);

    if (isNaN(teamSize) || teamSize < 1) teamSize = 1;
    if (teamSize > 250) teamSize = 250;

    if (isNaN(hoursSaved) || hoursSaved < 1) hoursSaved = 1;
    if (hoursSaved > 40) hoursSaved = 40;

    return { teamSize, hoursSaved };
  }

  updateBadges() {
    const { teamSize, hoursSaved } = this.getValidatedInputs();

    if (this.sliderTeamText) this.sliderTeamText.textContent = `${teamSize} Members`;
    if (this.sliderHoursText) this.sliderHoursText.textContent = `${hoursSaved} hrs/wk`;
  }

  scheduleBackendCalc() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.calculateBackend(), 100);
  }

  async calculateBackend() {
    const { teamSize, hoursSaved } = this.getValidatedInputs();
    const hourlyWageInr = 450; // Estimated baseline INR hourly rate

    try {
      const response = await fetch('/api/roi/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_size: teamSize,
          hourly_wage: hourlyWageInr,
          hours_saved: hoursSaved
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const resData = await response.json();

      if (resData.success && resData.results) {
        const r = resData.results;
        const netSavings = Math.max(0, Math.round(r.annual_net_savings || 0));
        const hoursTotal = Math.max(0, Math.round(r.annual_hours_saved || 0));

        if (this.roiAnnualVal) this.roiAnnualVal.textContent = '₹' + netSavings.toLocaleString('en-IN');
        if (this.roiHoursVal) this.roiHoursVal.textContent = hoursTotal.toLocaleString('en-IN');
        return;
      }
    } catch (err) {
      // Local validated fallback calculation in INR
      const weeklyHoursTotal = teamSize * hoursSaved;
      const annualHoursTotal = weeklyHoursTotal * 50;
      const annualSavings = Math.max(0, annualHoursTotal * hourlyWageInr);

      if (this.roiAnnualVal) this.roiAnnualVal.textContent = '₹' + Math.round(annualSavings).toLocaleString('en-IN');
      if (this.roiHoursVal) this.roiHoursVal.textContent = Math.round(annualHoursTotal).toLocaleString('en-IN');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new RoiCalculator();
});

window.RoiCalculator = RoiCalculator;
