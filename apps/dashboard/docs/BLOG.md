# Blog Documentation

The CryptoNews Blog is a static Markdown blog built with Next.js App Router.

## Overview

The blog system provides:
- **Static Markdown/MDX posts** stored in `/content/blog/`
- **YAML frontmatter** for metadata
- **Tag-based navigation** at `/blog/tag/[tag]`
- **SEO-optimized** with meta tags and OpenGraph
- **Related posts** based on tag similarity
- **Reading time** auto-calculated

## File Structure

```
content/
└── blog/
    ├── README.md                         # Instructions
    ├── welcome-to-our-blog.md           # Example post
    ├── getting-started-with-api.md      # Tutorial post
    └── understanding-crypto-sentiment.md # Educational post

src/
├── lib/
│   └── blog.ts                          # Blog utilities
└── app/
    └── blog/
        ├── page.tsx                     # Blog listing
        ├── [slug]/
        │   └── page.tsx                 # Individual post
        └── tag/
            └── [tag]/
                └── page.tsx             # Posts by tag
```

## Adding a New Post

1. Create a new `.md` file in `/content/blog/`
2. Add frontmatter with required fields:

```yaml
---
title: Your Post Title
excerpt: Short description (optional)
date: 2026-01-24
author:
  name: Your Name
tags:
  - tag1
  - tag2
---
```

3. Write your content in Markdown
4. The post will appear at `/blog/[filename-without-extension]`

## Frontmatter Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| title | Yes | string | Post title |
| date | Yes | string | YYYY-MM-DD format |
| author | Yes | object | `{ name, avatar?, twitter? }` |
| excerpt | No | string | Preview text |
| coverImage | No | string | Path to cover image |
| tags | No | string[] | Categorization |
| featured | No | boolean | Show in featured section |
| draft | No | boolean | Hide from listing |

## API Reference

### `getAllPosts(options?)`

Get all published posts (metadata only).

```typescript
import { getAllPosts } from '@/lib/blog';

const posts = getAllPosts();
// With drafts: getAllPosts({ includeDrafts: true })
```

### `getPostBySlug(slug)`

Get a single post with full content.

```typescript
import { getPostBySlug } from '@/lib/blog';

const post = getPostBySlug('welcome-to-our-blog');
```

### `getPostsByTag(tag)`

Get posts filtered by tag.

```typescript
import { getPostsByTag } from '@/lib/blog';

const posts = getPostsByTag('tutorial');
```

### `getAllTags()`

Get all tags with counts.

```typescript
import { getAllTags } from '@/lib/blog';

const tags = getAllTags();
// [{ tag: 'tutorial', count: 5 }, ...]
```

### `getRelatedPosts(slug, limit?)`

Get related posts based on tag overlap.

```typescript
import { getRelatedPosts } from '@/lib/blog';

const related = getRelatedPosts('my-post', 3);
```

## Styling

The blog uses Tailwind CSS with the `prose` typography plugin for content styling. Custom styles are applied in the `[slug]/page.tsx` component.

## SEO

Each post generates:
- `<title>` and `<meta description>`
- OpenGraph tags for social sharing
- Twitter card metadata
- Structured data (planned)

## Future Enhancements

- [ ] RSS feed generation
- [ ] Full-text search
- [ ] Comments system
- [ ] MDX component support
- [ ] Syntax highlighting with Shiki
- [ ] View counts
- [ ] Newsletter integration
