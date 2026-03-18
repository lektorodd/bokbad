import API from '../api.js';
import { t } from '../i18n.js';
import { Chart, registerables } from 'chart.js';
import { getGenreLabel } from './home.js';

// Register Chart.js components
Chart.register(...registerables);

let currentChart = null;
let genreChart = null;
let dailyChart = null;
let currentPeriod = '30d';

/**
 * Get the current dashboard period
 * @returns {string}
 */
export function getCurrentPeriod() {
  return currentPeriod;
}

/**
 * Set the current dashboard period
 * @param {string} period
 */
export function setCurrentPeriod(period) {
  currentPeriod = period;
}

function getDateRange(period) {
  const now = new Date();
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().split('T')[0] };
  }
  if (period === '12m') {
    const past = new Date(now);
    past.setMonth(past.getMonth() - 12);
    return { from: past.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
  }
  if (period === '30d') {
    const past = new Date(now);
    past.setDate(past.getDate() - 30);
    return { from: past.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
  }
  return { from: null, to: null };
}

/**
 * Load and render the dashboard
 */
export async function loadDashboard() {
  const { from, to } = getDateRange(currentPeriod);
  const is30d = currentPeriod === '30d';

  // Toggle chart visibility
  document.getElementById('daily-chart-container').classList.toggle('hidden', !is30d);
  document.getElementById('monthly-chart-container').classList.toggle('hidden', is30d);
  document.getElementById('genre-chart-container').style.display = is30d ? 'none' : '';

  // Single unified stats call for all periods
  const statsPromise = loadUnifiedStats(from, to);

  if (is30d) {
    await statsPromise;
  } else {
    await Promise.all([
      statsPromise,
      loadYearlyStats(new Date().getFullYear(), false),
      loadGenreChart(),
    ]);
    populateYearSelector();
  }
}

async function loadUnifiedStats(from, to) {
  try {
    const result = await API.getDashboardStats(from, to);
    if (!result.success) return;

    const {
      counts,
      totalPages,
      readMinutes,
      listenMinutes,
      avgDaysToFinish,
      booksPerMonth,
      streak,
      daily,
    } = result;

    // Status pills
    document.getElementById('stat-read').textContent = counts.read;
    document.getElementById('stat-reading').textContent = counts.reading;
    document.getElementById('stat-upnext').textContent = counts.upNext || 0;
    document.getElementById('stat-want').textContent = counts.wantToRead;

    // Metric tiles (consistent across all periods)
    document.getElementById('stat-pace').textContent =
      avgDaysToFinish !== null ? avgDaysToFinish : '—';
    document.getElementById('stat-per-month').textContent = booksPerMonth;
    document.getElementById('stat-pages').textContent =
      totalPages > 0 ? totalPages.toLocaleString() : '0';
    document.getElementById('stat-streak').textContent = streak;

    // Read time (paper + ebook sessions)
    if (readMinutes > 0) {
      const rh = Math.floor(readMinutes / 60);
      const rm = readMinutes % 60;
      document.getElementById('stat-read-time').textContent = rm > 0 ? `${rh}h ${rm}m` : `${rh}h`;
    } else {
      document.getElementById('stat-read-time').textContent = '—';
    }

    // Listen time (audiobook sessions)
    if (listenMinutes > 0) {
      const lh = Math.floor(listenMinutes / 60);
      const lm = listenMinutes % 60;
      document.getElementById('stat-listen-time').textContent =
        lm > 0 ? `${lh}h ${lm}m` : `${lh}h`;
    } else {
      document.getElementById('stat-listen-time').textContent = '—';
    }

    // Render daily chart if we have daily data (30d view)
    if (daily && daily.length > 0) {
      renderDailyChart(daily);
    }
  } catch (error) {
    console.error('Failed to load dashboard stats:', error);
  }
}

/**
 * Load yearly stats and render monthly chart
 * @param {number} year
 * @param {boolean} [compare=false]
 */
export async function loadYearlyStats(year, compare = false) {
  try {
    const result = await API.getYearlyStats(year, compare);
    if (result.success) {
      renderChart(
        result.monthlyBreakdown,
        compare ? result.previousMonthlyBreakdown : null,
        compare ? result.previousYear : null
      );
    }
  } catch (error) {
    console.error('Failed to load yearly stats:', error);
  }
}

async function loadGenreChart() {
  try {
    const result = await API.getGenreStats();
    if (result.success && result.genres.length > 0) {
      renderGenreChart(result.genres);
    } else {
      document.getElementById('genre-chart-container').style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load genre stats:', error);
    document.getElementById('genre-chart-container').style.display = 'none';
  }
}

// ============ Charts ============
function renderChart(monthlyData, prevYearData = null, prevYear = null) {
  const ctx = document.getElementById('monthly-chart');

  if (currentChart) {
    currentChart.destroy();
  }

  const labels = t('calendar.chartMonths');
  const data = monthlyData.map((m) => m.count);

  const datasets = [
    {
      label: t('dashboard.booksReadChart'),
      data,
      backgroundColor: '#6366f1',
      borderRadius: 4,
    },
  ];

  // Add previous year comparison line
  if (prevYearData && prevYear) {
    datasets.push({
      label: `${prevYear}`,
      data: prevYearData.map((m) => m.count),
      type: 'line',
      borderColor: '#a5b4fc',
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#a5b4fc',
      fill: false,
      tension: 0.3,
    });
  }

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: !!prevYearData,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  });
}

function renderGenreChart(genres) {
  const ctx = document.getElementById('genre-chart');

  if (genreChart) {
    genreChart.destroy();
  }

  // Take top 8 genres
  const topGenres = genres.slice(0, 8);

  const colors = [
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
  ];

  genreChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: topGenres.map((g) => getGenreLabel(g.name)),
      datasets: [
        {
          data: topGenres.map((g) => g.count),
          backgroundColor: colors.slice(0, topGenres.length),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.5,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            font: { size: 12 },
          },
        },
      },
    },
  });
}

/**
 * Populate the year selector dropdown
 */
export function populateYearSelector() {
  const selector = document.getElementById('year-selector');
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let i = currentYear; i >= currentYear - 10; i--) {
    years.push(i);
  }

  selector.innerHTML = years
    .map(
      (year) => `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
    )
    .join('');
}

function renderDailyChart(days) {
  const ctx = document.getElementById('daily-activity-chart');

  if (dailyChart) {
    dailyChart.destroy();
  }

  // Format labels as short dates (e.g. "Feb 20")
  const labels = days.map((d) => {
    const date = new Date(d.date + 'T12:00:00');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });

  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: t('dashboard.readingTime'),
          data: days.map((d) => d.readMinutes),
          backgroundColor: '#6366f1',
          borderRadius: 2,
        },
        {
          label: t('dashboard.listeningTime'),
          data: days.map((d) => d.listenMinutes),
          backgroundColor: '#a855f7',
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${context.raw} ${t('dashboard.minutes')}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            maxRotation: 45,
            font: { size: 10 },
            autoSkip: true,
            maxTicksLimit: 10,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: t('dashboard.minutes'),
            font: { size: 11 },
          },
        },
      },
    },
  });
}
