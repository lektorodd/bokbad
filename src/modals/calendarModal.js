import API from '../api.js';
import { t } from '../i18n.js';

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth() + 1;

/**
 * Open the activity calendar modal
 */
export function openActivityCalendar() {
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth() + 1;
  const modal = document.getElementById('calendar-modal');
  modal.classList.remove('hidden');
  renderCalendarMonth(calendarYear, calendarMonth);
}

async function renderCalendarMonth(year, month) {
  const body = document.getElementById('calendar-body');
  body.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const result = await API.getActivityCalendar(year, month);
    if (!result.success) {
      body.innerHTML = '';
      return;
    }

    const { sessions, streak, daysRead, totalSessions } = result;
    const monthNames = t('calendar.monthNames');

    // First day of month (0=Sun..6=Sat) → shift to Mon=0
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0, Sun=6

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Build grid cells
    let gridHtml = '';
    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      gridHtml += '<div class="cal-cell cal-empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasSession = sessions[dateStr];
      const isToday = dateStr === todayStr;
      const isFuture = new Date(dateStr) > today;
      const classes = ['cal-cell'];
      if (hasSession) classes.push('cal-active');
      if (isToday) classes.push('cal-today');
      if (isFuture) classes.push('cal-future');

      let tooltip = '';
      if (hasSession) {
        const parts = [];
        if (hasSession.pages > 0) parts.push(`${hasSession.pages}p`);
        if (hasSession.minutes > 0) parts.push(`${hasSession.minutes}min`);
        tooltip = parts.join(', ');
      }

      gridHtml += `<div class="${classes.join(' ')}" ${tooltip ? `title="${tooltip}"` : ''}><span class="cal-day">${d}</span></div>`;
    }

    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

    body.innerHTML = `
      <div class="cal-nav">
        <button class="btn-icon cal-prev" aria-label="Previous month">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="cal-month-label">${monthNames[month]} ${year}</span>
        <button class="btn-icon cal-next ${isCurrentMonth ? 'cal-disabled' : ''}" aria-label="Next month" ${isCurrentMonth ? 'disabled' : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      </div>
      <div class="cal-stats">
        <div class="cal-stat">
          <span class="cal-stat-val">${streak}</span>
          <span class="cal-stat-label">${t('calendar.dayStreak')}</span>
        </div>
        <div class="cal-stat">
          <span class="cal-stat-val">${daysRead}</span>
          <span class="cal-stat-label">${t('calendar.daysRead')}</span>
        </div>
        <div class="cal-stat">
          <span class="cal-stat-val">${totalSessions}</span>
          <span class="cal-stat-label">${t('calendar.sessions')}</span>
        </div>
      </div>
      <div class="cal-grid">
        ${t('calendar.dayHeaders')
          .map((d) => `<div class="cal-header">${d}</div>`)
          .join('')}
        ${gridHtml}
      </div>
    `;

    // Nav handlers
    body.querySelector('.cal-prev')?.addEventListener('click', () => {
      calendarMonth--;
      if (calendarMonth < 1) {
        calendarMonth = 12;
        calendarYear--;
      }
      renderCalendarMonth(calendarYear, calendarMonth);
    });
    body.querySelector('.cal-next')?.addEventListener('click', () => {
      if (isCurrentMonth) return;
      calendarMonth++;
      if (calendarMonth > 12) {
        calendarMonth = 1;
        calendarYear++;
      }
      renderCalendarMonth(calendarYear, calendarMonth);
    });
  } catch (error) {
    console.error('Failed to load calendar:', error);
    body.innerHTML = '<div class="empty-state-text">' + t('calendar.failedToLoad') + '</div>';
  }
}
