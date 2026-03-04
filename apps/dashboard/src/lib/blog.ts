/**
 * Blog Utilities
 * 
 * Handles reading and parsing Markdown blog posts with frontmatter
 */

import fs from 'fs';
import path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: {
    name: string;
    avatar?: string;
    twitter?: string;
  };
  coverImage?: string;
  tags: string[];
  readingTime: number;
  featured?: boolean;
  draft?: boolean;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: {
    name: string;
    avatar?: string;
  };
  coverImage?: string;
  tags: string[];
  readingTime: number;
  featured?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { data: {}, content };
  }
  
  const frontmatter = match[1];
  const body = match[2];
  
  // Parse YAML-like frontmatter
  const data: Record<string, unknown> = {};
  const lines = frontmatter.split('\n');
  
  let currentKey = '';
  let inArray = false;
  let arrayItems: string[] = [];
  
  for (const line of lines) {
    // Array item
    if (line.startsWith('  - ') && inArray) {
      arrayItems.push(line.replace('  - ', '').trim());
      continue;
    }
    
    // End array if we hit a new key
    if (inArray && !line.startsWith('  ')) {
      data[currentKey] = arrayItems;
      inArray = false;
      arrayItems = [];
    }
    
    // Key-value pair
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      
      if (value === '') {
        // Start of array or nested object
        currentKey = key;
        inArray = true;
        arrayItems = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
        data[key] = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim().replace(/^["']|["']$/g, ''));
      } else if (value === 'true') {
        data[key] = true;
      } else if (value === 'false') {
        data[key] = false;
      } else if (!isNaN(Number(value))) {
        data[key] = Number(value);
      } else {
        // String value - remove quotes if present
        data[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }
  
  // Handle final array
  if (inArray) {
    data[currentKey] = arrayItems;
  }
  
  return { data, content: body };
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Convert markdown to simple HTML (basic implementation)
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
  // Blockquotes
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
  
  // Unordered lists
  html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
  
  // Paragraphs
  html = html.replace(/\n\n([^<].*?)\n\n/g, '\n\n<p>$1</p>\n\n');
  
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  
  // Clean up
  html = html.replace(/<br \/><br \/>/g, '</p><p>');
  html = html.replace(/<br \/><h/g, '<h');
  html = html.replace(/<\/h(\d)><br \/>/g, '</h$1>');
  html = html.replace(/<br \/><ul>/g, '<ul>');
  html = html.replace(/<\/ul><br \/>/g, '</ul>');
  html = html.replace(/<br \/><blockquote>/g, '<blockquote>');
  html = html.replace(/<\/blockquote><br \/>/g, '</blockquote>');
  html = html.replace(/<br \/><pre>/g, '<pre>');
  html = html.replace(/<\/pre><br \/>/g, '</pre>');
  
  return html;
}

// =============================================================================
// BLOG POST FUNCTIONS
// =============================================================================

/**
 * Get all blog post slugs
 */
export function getAllPostSlugs(): string[] {
  try {
    if (!fs.existsSync(BLOG_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(BLOG_DIR);
    return files
      .filter(file => file.endsWith('.md') || file.endsWith('.mdx'))
      .map(file => file.replace(/\.mdx?$/, ''));
  } catch {
    return [];
  }
}

/**
 * Get a single blog post by slug
 */
export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const mdPath = path.join(BLOG_DIR, `${slug}.md`);
    const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
    
    const filePath = fs.existsSync(mdxPath) ? mdxPath : mdPath;
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data, content } = parseFrontmatter(fileContents);
    
    // Parse author
    let author = { name: 'Anonymous' };
    if (typeof data.author === 'string') {
      author = { name: data.author };
    } else if (typeof data.author === 'object' && data.author !== null) {
      author = data.author as BlogPost['author'];
    }
    
    return {
      slug,
      title: (data.title as string) || slug,
      excerpt: (data.excerpt as string) || content.slice(0, 160).replace(/[#*`]/g, '') + '...',
      content,
      date: (data.date as string) || new Date().toISOString(),
      author,
      coverImage: data.coverImage as string | undefined,
      tags: (data.tags as string[]) || [],
      readingTime: calculateReadingTime(content),
      featured: (data.featured as boolean) || false,
      draft: (data.draft as boolean) || false,
    };
  } catch (error) {
    console.error(`Error reading post ${slug}:`, error);
    return null;
  }
}

/**
 * Get all blog posts (metadata only)
 */
export function getAllPosts(options: { includeDrafts?: boolean } = {}): BlogPostMeta[] {
  const slugs = getAllPostSlugs();
  const posts: BlogPostMeta[] = [];
  
  for (const slug of slugs) {
    const post = getPostBySlug(slug);
    if (post && (!post.draft || options.includeDrafts)) {
      posts.push({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        date: post.date,
        author: post.author,
        coverImage: post.coverImage,
        tags: post.tags,
        readingTime: post.readingTime,
        featured: post.featured,
      });
    }
  }
  
  // Sort by date (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get featured posts
 */
export function getFeaturedPosts(limit = 3): BlogPostMeta[] {
  return getAllPosts().filter(post => post.featured).slice(0, limit);
}

/**
 * Get posts by tag
 */
export function getPostsByTag(tag: string): BlogPostMeta[] {
  return getAllPosts().filter(post => 
    post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
  );
}

/**
 * Get all unique tags
 */
export function getAllTags(): { tag: string; count: number }[] {
  const posts = getAllPosts();
  const tagCounts = new Map<string, number>();
  
  for (const post of posts) {
    for (const tag of post.tags) {
      const normalized = tag.toLowerCase();
      tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
    }
  }
  
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get related posts
 */
export function getRelatedPosts(currentSlug: string, limit = 3): BlogPostMeta[] {
  const currentPost = getPostBySlug(currentSlug);
  if (!currentPost) return [];
  
  const allPosts = getAllPosts().filter(p => p.slug !== currentSlug);
  
  // Score posts by tag overlap
  const scored = allPosts.map(post => {
    const commonTags = post.tags.filter(tag => 
      currentPost.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
    return { post, score: commonTags.length };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.post);
}
