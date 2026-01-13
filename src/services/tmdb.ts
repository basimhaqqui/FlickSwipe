/**
 * TMDB API Service
 * Handles all movie data fetching from The Movie Database API
 *
 * Features:
 * - Popular/trending movies
 * - Movie details with trailers
 * - Reviews and ratings
 * - Genre-based filtering
 * - Caching for performance
 */

import {
  Movie,
  MovieDetails,
  Trailer,
  Review,
  Genre,
  StreamingService,
} from '../types';
import { TMDB, GENRES } from '../constants';

// ============================================================================
// CONFIGURATION
// Replace with your TMDB API key (get one at https://www.themoviedb.org/settings/api)
// ============================================================================

const TMDB_API_KEY = 'YOUR_TMDB_API_KEY';
const TMDB_ACCESS_TOKEN = 'YOUR_TMDB_ACCESS_TOKEN'; // v4 Bearer token

// Headers for authenticated requests
const headers = {
  'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// MOCK DATA FOR TESTING (used when API key is not configured)
// ============================================================================

const MOCK_MOVIES: Movie[] = [
  {
    id: 550,
    title: 'Fight Club',
    originalTitle: 'Fight Club',
    posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    backdropPath: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
    overview: 'A ticking-Loss time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
    releaseDate: '1999-10-15',
    voteAverage: 8.4,
    voteCount: 26000,
    popularity: 73.0,
    genreIds: [18, 53, 35],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 680,
    title: 'Pulp Fiction',
    originalTitle: 'Pulp Fiction',
    posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
    backdropPath: '/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg',
    overview: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.',
    releaseDate: '1994-09-10',
    voteAverage: 8.5,
    voteCount: 24000,
    popularity: 67.0,
    genreIds: [53, 80],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 238,
    title: 'The Godfather',
    originalTitle: 'The Godfather',
    posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    backdropPath: '/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
    overview: 'Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family.',
    releaseDate: '1972-03-14',
    voteAverage: 8.7,
    voteCount: 18000,
    popularity: 88.0,
    genreIds: [18, 80],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 278,
    title: 'The Shawshank Redemption',
    originalTitle: 'The Shawshank Redemption',
    posterPath: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
    backdropPath: '/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
    overview: 'Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison.',
    releaseDate: '1994-09-23',
    voteAverage: 8.7,
    voteCount: 23000,
    popularity: 82.0,
    genreIds: [18, 80],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 155,
    title: 'The Dark Knight',
    originalTitle: 'The Dark Knight',
    posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdropPath: '/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg',
    overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations.',
    releaseDate: '2008-07-16',
    voteAverage: 8.5,
    voteCount: 29000,
    popularity: 95.0,
    genreIds: [18, 28, 80, 53],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 13,
    title: 'Forrest Gump',
    originalTitle: 'Forrest Gump',
    posterPath: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
    backdropPath: '/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg',
    overview: 'A man with a low IQ has accomplished great things in his life and been present during significant historic events—in each case, far exceeding what anyone imagined he could do.',
    releaseDate: '1994-06-23',
    voteAverage: 8.5,
    voteCount: 24000,
    popularity: 71.0,
    genreIds: [35, 18, 10749],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 603,
    title: 'The Matrix',
    originalTitle: 'The Matrix',
    posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    backdropPath: '/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
    overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
    releaseDate: '1999-03-30',
    voteAverage: 8.2,
    voteCount: 22000,
    popularity: 79.0,
    genreIds: [28, 878],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 120,
    title: 'The Lord of the Rings: The Fellowship of the Ring',
    originalTitle: 'The Lord of the Rings: The Fellowship of the Ring',
    posterPath: '/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
    backdropPath: '/pIUvQ9Ed35wlWhY2oU6OmwEsmzG.jpg',
    overview: 'Young hobbit Frodo Baggins, after inheriting a mysterious ring from his uncle Bilbo, must leave his home in order to keep it from falling into the hands of its evil creator.',
    releaseDate: '2001-12-18',
    voteAverage: 8.4,
    voteCount: 22000,
    popularity: 92.0,
    genreIds: [12, 14, 28],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 569094,
    title: 'Spider-Man: Across the Spider-Verse',
    originalTitle: 'Spider-Man: Across the Spider-Verse',
    posterPath: '/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    backdropPath: '/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg',
    overview: "After reuniting with Gwen Stacy, Brooklyn's full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse.",
    releaseDate: '2023-05-31',
    voteAverage: 8.4,
    voteCount: 5000,
    popularity: 150.0,
    genreIds: [16, 28, 12, 878],
    adult: false,
    originalLanguage: 'en',
  },
  {
    id: 157336,
    title: 'Interstellar',
    originalTitle: 'Interstellar',
    posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropPath: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.',
    releaseDate: '2014-11-05',
    voteAverage: 8.4,
    voteCount: 32000,
    popularity: 110.0,
    genreIds: [12, 18, 878],
    adult: false,
    originalLanguage: 'en',
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Make a cached API request
 */
async function fetchWithCache<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const queryString = new URLSearchParams({
    ...params,
    api_key: TMDB_API_KEY,
  }).toString();

  const url = `${TMDB.BASE_URL}${endpoint}?${queryString}`;
  const cacheKey = url;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();

    // Update cache
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error('TMDB fetch error:', error);
    throw error;
  }
}

/**
 * Get full poster URL
 */
export function getPosterUrl(path: string | null, size: string = TMDB.POSTER_SIZE): string {
  if (!path) {
    return 'https://via.placeholder.com/500x750?text=No+Poster';
  }
  return `${TMDB.IMAGE_BASE_URL}/${size}${path}`;
}

/**
 * Get full backdrop URL
 */
export function getBackdropUrl(path: string | null): string {
  if (!path) {
    return 'https://via.placeholder.com/1280x720?text=No+Image';
  }
  return `${TMDB.IMAGE_BASE_URL}/${TMDB.BACKDROP_SIZE}${path}`;
}

/**
 * Get genre name from ID
 */
export function getGenreName(genreId: number): string {
  return GENRES[genreId] || 'Unknown';
}

/**
 * Format runtime to hours and minutes
 */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format vote average to percentage
 */
export function formatRating(voteAverage: number): string {
  return `${Math.round(voteAverage * 10)}%`;
}

/**
 * Format release date to year
 */
export function getReleaseYear(releaseDate: string): string {
  if (!releaseDate) return 'TBA';
  return releaseDate.split('-')[0];
}

// ============================================================================
// MOVIE DISCOVERY
// ============================================================================

interface TMDBMovieListResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

/**
 * Get popular movies
 */
export async function getPopularMovies(page: number = 1): Promise<Movie[]> {
  try {
    const response = await fetchWithCache<TMDBMovieListResponse>('/movie/popular', {
      page: String(page),
      language: 'en-US',
    });

    return response.results.map(normalizeMovie);
  } catch (error) {
    console.log('Using mock movie data (configure TMDB_API_KEY for real data)');
    // Return mock data shuffled for variety
    return [...MOCK_MOVIES].sort(() => Math.random() - 0.5);
  }
}

/**
 * Get trending movies (daily or weekly)
 */
export async function getTrendingMovies(
  timeWindow: 'day' | 'week' = 'week',
  page: number = 1
): Promise<Movie[]> {
  try {
    const response = await fetchWithCache<TMDBMovieListResponse>(
      `/trending/movie/${timeWindow}`,
      { page: String(page) }
    );

    return response.results.map(normalizeMovie);
  } catch (error) {
    console.log('Using mock movie data (configure TMDB_API_KEY for real data)');
    // Return mock data shuffled for variety
    return [...MOCK_MOVIES].sort(() => Math.random() - 0.5);
  }
}

/**
 * Get top rated movies
 */
export async function getTopRatedMovies(page: number = 1): Promise<Movie[]> {
  const response = await fetchWithCache<TMDBMovieListResponse>('/movie/top_rated', {
    page: String(page),
    language: 'en-US',
  });

  return response.results.map(normalizeMovie);
}

/**
 * Get movies by genre(s)
 */
export async function getMoviesByGenres(
  genreIds: number[],
  page: number = 1
): Promise<Movie[]> {
  const response = await fetchWithCache<TMDBMovieListResponse>('/discover/movie', {
    page: String(page),
    with_genres: genreIds.join(','),
    sort_by: 'popularity.desc',
    language: 'en-US',
    include_adult: 'false',
    'vote_count.gte': '100', // Only movies with decent vote count
  });

  return response.results.map(normalizeMovie);
}

/**
 * Discover movies with multiple filters
 */
export async function discoverMovies(options: {
  page?: number;
  genres?: number[];
  minRating?: number;
  minYear?: number;
  maxYear?: number;
  sortBy?: string;
}): Promise<Movie[]> {
  const {
    page = 1,
    genres,
    minRating = 6,
    minYear,
    maxYear,
    sortBy = 'popularity.desc',
  } = options;

  const params: Record<string, string> = {
    page: String(page),
    sort_by: sortBy,
    language: 'en-US',
    include_adult: 'false',
    'vote_count.gte': '50',
    'vote_average.gte': String(minRating),
  };

  if (genres && genres.length > 0) {
    params.with_genres = genres.join('|'); // OR logic
  }

  if (minYear) {
    params['primary_release_date.gte'] = `${minYear}-01-01`;
  }

  if (maxYear) {
    params['primary_release_date.lte'] = `${maxYear}-12-31`;
  }

  const response = await fetchWithCache<TMDBMovieListResponse>(
    '/discover/movie',
    params
  );

  return response.results.map(normalizeMovie);
}

/**
 * Get movies for calibration (popular across diverse genres)
 */
export async function getCalibrationMovies(): Promise<Movie[]> {
  // Get a diverse mix of popular movies from different genres
  const moviePromises = TMDB.CALIBRATION_GENRES.map((genreId) =>
    getMoviesByGenres([genreId], 1).then((movies) =>
      movies.slice(0, 2) // Take top 2 from each genre
    )
  );

  const moviesByGenre = await Promise.all(moviePromises);
  const allMovies = moviesByGenre.flat();

  // Shuffle and take required amount
  const shuffled = allMovies.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, TMDB.CALIBRATION_MOVIE_COUNT);
}

/**
 * Get movies for swiping session (filtered by preferences and exclusions)
 */
export async function getSwipeMovies(options: {
  favoriteGenres?: number[];
  excludeMovieIds?: Set<number>;
  page?: number;
}): Promise<Movie[]> {
  const { favoriteGenres = [], excludeMovieIds = new Set(), page = 1 } = options;

  let movies: Movie[];

  if (favoriteGenres.length > 0) {
    // Fetch from favorite genres
    movies = await discoverMovies({
      page,
      genres: favoriteGenres,
      minRating: 5.5,
    });
  } else {
    // Fallback to popular movies
    movies = await getPopularMovies(page);
  }

  // Filter out already swiped movies
  const filtered = movies.filter((m) => !excludeMovieIds.has(m.id));

  return filtered;
}

// ============================================================================
// MOVIE DETAILS
// ============================================================================

/**
 * Get detailed movie information
 */
export async function getMovieDetails(movieId: number): Promise<MovieDetails> {
  const response = await fetchWithCache<any>(`/movie/${movieId}`, {
    language: 'en-US',
    append_to_response: 'credits,videos',
  });

  const movie: MovieDetails = {
    id: response.id,
    title: response.title,
    originalTitle: response.original_title,
    posterPath: response.poster_path,
    backdropPath: response.backdrop_path,
    overview: response.overview,
    releaseDate: response.release_date,
    voteAverage: response.vote_average,
    voteCount: response.vote_count,
    popularity: response.popularity,
    genreIds: response.genres.map((g: Genre) => g.id),
    runtime: response.runtime,
    adult: response.adult,
    originalLanguage: response.original_language,
    genres: response.genres,
    productionCompanies: response.production_companies,
    tagline: response.tagline,
    budget: response.budget,
    revenue: response.revenue,
    status: response.status,
    credits: response.credits,
  };

  // Extract trailer key if available
  if (response.videos?.results?.length > 0) {
    const trailer = findBestTrailer(response.videos.results);
    if (trailer) {
      movie.trailerKey = trailer.key;
    }
  }

  return movie;
}

/**
 * Get movie runtime (lightweight fetch)
 */
export async function getMovieRuntime(movieId: number): Promise<number | null> {
  try {
    const details = await getMovieDetails(movieId);
    return details.runtime || null;
  } catch {
    return null;
  }
}

// ============================================================================
// TRAILERS
// ============================================================================

interface TMDBVideoResponse {
  id: number;
  results: Trailer[];
}

/**
 * Get movie trailers/videos
 */
export async function getMovieVideos(movieId: number): Promise<Trailer[]> {
  const response = await fetchWithCache<TMDBVideoResponse>(
    `/movie/${movieId}/videos`,
    { language: 'en-US' }
  );

  return response.results.filter(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );
}

/**
 * Find the best trailer from a list
 */
export function findBestTrailer(videos: Trailer[]): Trailer | null {
  if (!videos || videos.length === 0) return null;

  // Priority: Official Trailer > Trailer > Teaser
  const officialTrailer = videos.find(
    (v) => v.official && v.type === 'Trailer' && v.site === 'YouTube'
  );
  if (officialTrailer) return officialTrailer;

  const anyTrailer = videos.find(
    (v) => v.type === 'Trailer' && v.site === 'YouTube'
  );
  if (anyTrailer) return anyTrailer;

  const teaser = videos.find(
    (v) => v.type === 'Teaser' && v.site === 'YouTube'
  );
  if (teaser) return teaser;

  return videos.find((v) => v.site === 'YouTube') || null;
}

/**
 * Get YouTube embed URL for a video key
 */
export function getYouTubeEmbedUrl(key: string): string {
  return `https://www.youtube.com/embed/${key}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`;
}

/**
 * Get trailer key for a movie (convenience function)
 */
export async function getMovieTrailerKey(movieId: number): Promise<string | null> {
  try {
    const videos = await getMovieVideos(movieId);
    const best = findBestTrailer(videos);
    return best?.key || null;
  } catch {
    return null;
  }
}

// ============================================================================
// REVIEWS
// ============================================================================

interface TMDBReviewResponse {
  id: number;
  page: number;
  results: Review[];
  total_pages: number;
  total_results: number;
}

/**
 * Get movie reviews
 */
export async function getMovieReviews(
  movieId: number,
  page: number = 1
): Promise<{ reviews: Review[]; totalPages: number }> {
  const response = await fetchWithCache<TMDBReviewResponse>(
    `/movie/${movieId}/reviews`,
    {
      page: String(page),
      language: 'en-US',
    }
  );

  return {
    reviews: response.results.map((r) => ({
      ...r,
      // Truncate long reviews for display
      content: r.content.length > 500 ? r.content.substring(0, 500) + '...' : r.content,
    })),
    totalPages: response.total_pages,
  };
}

/**
 * Get aggregated review data (rating distribution, scores)
 */
export async function getMovieRatingDetails(movieId: number): Promise<{
  tmdbRating: number;
  tmdbVoteCount: number;
  hasReviews: boolean;
  reviewCount: number;
}> {
  const [details, reviews] = await Promise.all([
    getMovieDetails(movieId),
    getMovieReviews(movieId, 1),
  ]);

  return {
    tmdbRating: details.voteAverage,
    tmdbVoteCount: details.voteCount,
    hasReviews: reviews.reviews.length > 0,
    reviewCount: reviews.reviews.length,
  };
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Search for movies by title
 */
export async function searchMovies(
  query: string,
  page: number = 1
): Promise<Movie[]> {
  if (!query.trim()) return [];

  const response = await fetchWithCache<TMDBMovieListResponse>('/search/movie', {
    query: encodeURIComponent(query),
    page: String(page),
    language: 'en-US',
    include_adult: 'false',
  });

  return response.results.map(normalizeMovie);
}

// ============================================================================
// GENRES
// ============================================================================

interface TMDBGenreResponse {
  genres: Genre[];
}

/**
 * Get all movie genres
 */
export async function getGenres(): Promise<Genre[]> {
  const response = await fetchWithCache<TMDBGenreResponse>('/genre/movie/list', {
    language: 'en-US',
  });
  return response.genres;
}

// ============================================================================
// STREAMING AVAILABILITY (Stub - would use JustWatch/Watchmode API in production)
// ============================================================================

/**
 * Get streaming availability for a movie
 * NOTE: This is a stub. In production, integrate with JustWatch API or Watchmode API
 */
export async function getStreamingAvailability(
  movieId: number,
  _userServices: StreamingService[]
): Promise<StreamingService[]> {
  // Stub implementation - randomly assign 1-3 services
  // In production, use JustWatch API: https://apis.justwatch.com/
  const allServices: StreamingService[] = [
    'netflix',
    'prime',
    'disney',
    'hulu',
    'max',
    'peacock',
  ];

  const shuffled = allServices.sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * 3) + 1;

  return shuffled.slice(0, count);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize TMDB movie response to our Movie type
 */
function normalizeMovie(tmdbMovie: any): Movie {
  return {
    id: tmdbMovie.id,
    title: tmdbMovie.title,
    originalTitle: tmdbMovie.original_title,
    posterPath: tmdbMovie.poster_path,
    backdropPath: tmdbMovie.backdrop_path,
    overview: tmdbMovie.overview,
    releaseDate: tmdbMovie.release_date || '',
    voteAverage: tmdbMovie.vote_average,
    voteCount: tmdbMovie.vote_count,
    popularity: tmdbMovie.popularity,
    genreIds: tmdbMovie.genre_ids || [],
    runtime: tmdbMovie.runtime,
    adult: tmdbMovie.adult,
    originalLanguage: tmdbMovie.original_language,
  };
}

/**
 * Prefetch movie details and trailer for upcoming cards
 */
export async function prefetchMovieData(movieIds: number[]): Promise<void> {
  await Promise.allSettled(
    movieIds.map((id) =>
      Promise.all([
        getMovieDetails(id),
        getMovieTrailerKey(id),
      ])
    )
  );
}

/**
 * Clear cache (useful for forcing fresh data)
 */
export function clearCache(): void {
  cache.clear();
}
