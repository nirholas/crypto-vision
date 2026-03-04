/**
 * Slug Utilities
 * 
 * Centralized slug generation and URL handling for SEO-friendly URLs
 */

// =============================================================================
// SLUG GENERATION
// =============================================================================

/**
 * Generate a URL-safe slug from any string
 * 
 * @example
 * generateSlug("Bitcoin Hits $100K!") // "bitcoin-hits-100k"
 * generateSlug("What's Next for ETH?") // "whats-next-for-eth"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace special characters
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[$]/g, '') // Remove dollar signs
    .replace(/[&]/g, 'and') // Replace & with 'and'
    .replace(/[@]/g, 'at') // Replace @ with 'at'
    .replace(/[#]/g, '') // Remove hashtags
    .replace(/[%]/g, 'percent') // Replace % with 'percent'
    // Replace spaces and special chars with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Limit length (for URLs)
    .slice(0, 80);
}

/**
 * Generate a unique slug with ID suffix
 * Useful for ensuring uniqueness while maintaining readability
 * 
 * @example
 * generateUniqueSlug("Bitcoin News", "abc123") // "bitcoin-news-abc123"
 */
export function generateUniqueSlug(text: string, id: string): string {
  const baseSlug = generateSlug(text);
  const shortId = id.slice(0, 8);
  return `${baseSlug}-${shortId}`;
}

/**
 * Extract the ID from a unique slug
 * 
 * @example
 * extractIdFromSlug("bitcoin-news-abc123") // "abc123"
 */
export function extractIdFromSlug(slug: string): string | null {
  const parts = slug.split('-');
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

/**
 * Generate article slug from title and date
 * Format: title-slug-YYYYMMDD
 */
export function generateArticleSlug(title: string, date: string | Date): string {
  const baseSlug = generateSlug(title).slice(0, 60);
  const dateStr = typeof date === 'string' ? new Date(date) : date;
  const dateSlug = dateStr.toISOString().slice(0, 10).replace(/-/g, '');
  return `${baseSlug}-${dateSlug}`;
}

// =============================================================================
// URL BUILDERS
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cryptonews.example.com';

/**
 * Build a full canonical URL
 */
export function buildCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
}

/**
 * Article URL builder
 */
export function buildArticleUrl(id: string, title?: string): string {
  if (title) {
    return `/article/${generateUniqueSlug(title, id)}`;
  }
  return `/article/${id}`;
}

/**
 * Coin URL builder
 */
export function buildCoinUrl(coinId: string, name?: string): string {
  if (name) {
    const slug = generateSlug(name);
    return `/coin/${slug}`;
  }
  return `/coin/${coinId.toLowerCase()}`;
}

/**
 * Category URL builder
 */
export function buildCategoryUrl(category: string): string {
  return `/category/${generateSlug(category)}`;
}

/**
 * Topic URL builder
 */
export function buildTopicUrl(topic: string): string {
  return `/topic/${generateSlug(topic)}`;
}

/**
 * Source URL builder
 */
export function buildSourceUrl(source: string): string {
  return `/source/${generateSlug(source)}`;
}

/**
 * Blog post URL builder
 */
export function buildBlogUrl(slug: string): string {
  return `/blog/${slug}`;
}

/**
 * Blog tag URL builder
 */
export function buildBlogTagUrl(tag: string): string {
  return `/blog/tag/${generateSlug(tag)}`;
}

/**
 * Search URL builder
 */
export function buildSearchUrl(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

// =============================================================================
// URL PARSING
// =============================================================================

/**
 * Parse an article URL to extract ID
 * Supports both old (/article/abc123) and new (/article/bitcoin-news-abc123) formats
 */
export function parseArticleUrl(slug: string): { id: string; title?: string } {
  // Check if it's a unique slug (has hyphen-separated parts ending with ID)
  const parts = slug.split('-');
  
  // If it looks like a UUID or hash (no hyphens except in UUID format)
  if (parts.length === 1 || /^[a-f0-9-]{32,}$/i.test(slug)) {
    return { id: slug };
  }
  
  // Extract ID from the end of the slug
  const id = parts[parts.length - 1];
  const titleSlug = parts.slice(0, -1).join('-');
  
  return { id, title: titleSlug };
}

/**
 * Check if a slug matches the expected format for an article
 */
export function isValidArticleSlug(slug: string): boolean {
  // Should be lowercase, alphanumeric with hyphens
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 100;
}

// =============================================================================
// SLUG MAPPINGS (for redirects)
// =============================================================================

export interface SlugMapping {
  oldPath: string;
  newPath: string;
  permanent: boolean;
}

/**
 * Create a mapping for URL migrations
 */
export function createSlugMapping(
  oldPath: string,
  newPath: string,
  permanent = true
): SlugMapping {
  return { oldPath, newPath, permanent };
}

// =============================================================================
// SEO HELPERS
// =============================================================================

/**
 * Generate breadcrumb data for structured data
 */
export function generateBreadcrumbs(
  items: Array<{ name: string; url: string }>
): Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> {
  return items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: buildCanonicalUrl(item.url),
  }));
}

/**
 * Format a slug for display (convert hyphens to spaces, capitalize)
 */
export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validate and normalize a slug from URL params
 */
export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
}
