// Title, pause, options, mission briefings/results, safehouse saves and the wasted card.
import { MISSION_DEFINITIONS } from './missions.js';

export class ScreenManager {
  constructor() {
    this.screens = ['title-screen', 'pause-screen', 'options-screen', 'result-screen', 'death-screen'].map((id) => document.getElementById(id));
    this.title = document.getElementById('title-screen');
    this.pause = document.getElementById('pause-screen');
    this.options = document.getElementById('options-screen');
    this.result = document.getElementById('result-screen');
    this.death = document.getElementById('death-screen');
    this.briefing = document.getElementById('briefing');
    this.onAction = () => {};
    this.volume = 0.65;
    this.sensitivity = 0.75;
    this.optionsReturn = 'title';
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onAction(button.dataset.action, button.dataset.value);
      });
    });
    document.getElementById('volume').addEventListener('input', (event) => {
      this.volume = Number(event.target.value);
      document.getElementById('volume-value').textContent = `${Math.round(this.volume * 100)}%`;
    });
    document.getElementById('sensitivity').addEventListener('input', (event) => {
      this.sensitivity = Number(event.target.value);
      document.getElementById('sensitivity-value').textContent = `${Math.round(this.sensitivity * 100)}%`;
    });
  }

  hideAll() {
    this.screens.forEach((screen) => screen.classList.add('hidden'));
    this.briefing.classList.add('hidden');
  }

  showTitle(hasSave) {
    this.hideAll();
    this.title.classList.remove('hidden');
    document.getElementById('continue-button').disabled = !hasSave;
    document.getElementById('continue-button').textContent = hasSave ? 'CONTINUE' : 'CONTINUE — NO SAVE';
    document.getElementById('title-progress').textContent = hasSave ? 'AUTOSAVE FOUND · YOUR CITY IS WAITING' : '8 STORY MISSIONS · 6 DISTRICTS · ONE DEBT TO SETTLE';
  }

  showPause(game) {
    this.hideAll();
    this.pause.classList.remove('hidden');
    document.getElementById('pause-mission').textContent = `${game.missions.completedCount} / 8 MISSIONS COMPLETE`;
    document.getElementById('pause-cash').textContent = `$${game.cash.toLocaleString('en-US')} · ${game.respect} RESPECT`;
    this.updateSlotLabels(game);
  }

  updateSlotLabels(game) {
    for (let slot = 1; slot <= 3; slot++) {
      const info = game.save.slotSummary(slot);
      document.getElementById(`save-slot-${slot}`).textContent = info ? `SLOT ${slot} — ${info.mission}/8 · $${info.cash}` : `SLOT ${slot} — EMPTY`;
    }
  }

  showOptions(returnTo = 'title') {
    this.optionsReturn = returnTo;
    this.hideAll();
    this.options.classList.remove('hidden');
  }

  closeOptions(game) {
    if (this.optionsReturn === 'pause') this.showPause(game);
    else this.showTitle(game.save.hasAutosave());
  }

  showBriefing(definition, index) {
    document.getElementById('briefing-number').textContent = `STORY ${String(index + 1).padStart(2, '0')} / 08`;
    document.getElementById('briefing-contact').textContent = definition.contact;
    document.getElementById('briefing-title').textContent = definition.title;
    document.getElementById('briefing-copy').textContent = definition.brief;
    this.briefing.classList.remove('hidden');
    window.setTimeout(() => this.briefing.classList.add('hidden'), 7000);
  }

  showMissionResult(definition, reward, finale = false) {
    this.hideAll();
    this.result.classList.remove('hidden');
    document.getElementById('result-kicker').textContent = finale ? 'THE COLONEL HAS FALLEN' : `MISSION ${definition.title ? MISSION_DEFINITIONS.indexOf(definition) + 1 : ''} COMPLETE`;
    document.getElementById('result-title').textContent = finale ? 'CIELO MAR BREATHES AGAIN' : definition.title;
    document.getElementById('result-reward').textContent = `+$${reward.toLocaleString('en-US')}`;
    document.getElementById('result-copy').textContent = finale ? 'Rafa and Inés have breakfast waiting. Free roam, deliveries and night races remain open.' : 'The next contact is ready at Inés’s food cart. Autosave updated.';
    document.getElementById('result-continue').textContent = finale ? 'RETURN TO THE CITY' : 'CONTINUE';
  }

  showMissionFailed(reason) {
    this.hideAll();
    this.result.classList.remove('hidden');
    document.getElementById('result-kicker').textContent = 'MISSION FAILED';
    document.getElementById('result-title').textContent = 'THE CITY KEEPS SCORE';
    document.getElementById('result-reward').textContent = 'RETRY AVAILABLE';
    document.getElementById('result-copy').textContent = reason;
    document.getElementById('result-continue').textContent = 'RETURN TO THE CITY';
  }

  showWasted(fee) {
    this.hideAll();
    this.death.classList.remove('hidden');
    document.getElementById('hospital-fee').textContent = `HOSPITAL FEE −$${fee}`;
  }

  showLoadNotice(message) {
    document.getElementById('title-progress').textContent = message;
  }
}
