// Predefined genre keys — labels come from i18n (genres.xxx)
export const GENRE_HIERARCHY = {
  fiction: [
    'novel',
    'thriller',
    'mystery',
    'scifi',
    'fantasy',
    'romance',
    'horror',
    'drama',
    'classic',
    'poetry',
    'humor',
    'ya',
    'children',
    'graphic'
  ],
  nonfiction: [
    'biography',
    'memoir',
    'history',
    'science',
    'selfhelp',
    'business',
    'philosophy',
    'health',
    'politics',
    'religion',
    'travel',
    'cooking',
    'art',
    'essays'
  ]
};

export const PREDEFINED_GENRES = [...GENRE_HIERARCHY.fiction, ...GENRE_HIERARCHY.nonfiction];

/**
 * Map a legacy free-text genre to a predefined key (case-insensitive).
 * @param {string} rawGenre
 * @returns {string}
 */
export function normalizeGenreKey(rawGenre) {
  const lower = rawGenre.trim().toLowerCase();
  if (PREDEFINED_GENRES.includes(lower)) return lower;
  // Try matching against English labels
  const enLabels = {
    fiction: 'fiction',
    'non-fiction': 'nonfiction',
    nonfiction: 'nonfiction',
    biography: 'biography',
    novel: 'novel',
    thriller: 'thriller',
    mystery: 'mystery',
    'sci-fi': 'scifi',
    scifi: 'scifi',
    fantasy: 'fantasy',
    history: 'history',
    science: 'science',
    'self-help': 'selfhelp',
    selfhelp: 'selfhelp',
    business: 'business',
    philosophy: 'philosophy',
    poetry: 'poetry',
    "children's": 'children',
    children: 'children',
    'young adult': 'ya',
    ya: 'ya',
    humor: 'humor',
    humour: 'humor',
    travel: 'travel',
    cooking: 'cooking',
    art: 'art',
    health: 'health',
    religion: 'religion',
    politics: 'politics',
    memoir: 'memoir',
    romance: 'romance',
    horror: 'horror',
    'graphic novel': 'graphic',
    graphic: 'graphic',
    essays: 'essays',
    classic: 'classic',
    drama: 'drama'
  };
  if (enLabels[lower]) return enLabels[lower];
  // Try matching against Norwegian labels
  const noLabels = {
    skjønnlitteratur: 'fiction',
    sakprosa: 'nonfiction',
    biografi: 'biography',
    roman: 'novel',
    krim: 'mystery',
    historie: 'history',
    vitenskap: 'science',
    selvhjelp: 'selfhelp',
    næringsliv: 'business',
    filosofi: 'philosophy',
    poesi: 'poetry',
    barnebøker: 'children',
    ungdom: 'ya',
    reise: 'travel',
    'mat og drikke': 'cooking',
    kunst: 'art',
    helse: 'health',
    politikk: 'politics',
    memoar: 'memoir',
    romantikk: 'romance',
    skrekk: 'horror',
    tegneserie: 'graphic',
    essay: 'essays',
    klassiker: 'classic'
  };
  if (noLabels[lower]) return noLabels[lower];
  return lower; // fallback: keep as-is
}

/**
 * Normalize an array of genre strings, deduplicating and filtering parent genres.
 * @param {string[]|null|undefined} genres
 * @returns {string[]}
 */
export function normalizeGenres(genres) {
  if (!genres || !Array.isArray(genres)) return [];
  const normalized = genres
    .map((g) => normalizeGenreKey(g))
    .filter((g) => g !== 'fiction' && g !== 'nonfiction'); // Strip legacy parent genres
  return [...new Set(normalized)]; // deduplicate
}
