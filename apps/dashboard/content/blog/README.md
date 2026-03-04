# Blog

This directory contains all blog posts written in Markdown format with YAML frontmatter.

## Creating a New Post

1. Create a new `.md` or `.mdx` file in this directory
2. The filename becomes the URL slug (e.g., `my-post.md` → `/blog/my-post`)
3. Add frontmatter at the top of the file

## Frontmatter Schema

```yaml
---
title: Your Post Title (required)
excerpt: A short description for previews (optional, auto-generated from content)
date: 2026-01-24 (required, YYYY-MM-DD format)
author:
  name: Author Name (required)
  avatar: /path/to/avatar.jpg (optional)
  twitter: twitterhandle (optional, without @)
coverImage: /path/to/cover.jpg (optional)
tags: (optional)
  - tag1
  - tag2
featured: true (optional, boolean)
draft: true (optional, boolean - hides from listing)
---
```

## Example Post

```markdown
---
title: Getting Started with Bitcoin
excerpt: Learn the basics of Bitcoin and how it works.
date: 2026-01-24
author:
  name: Satoshi
  avatar: /icons/icon-192.png
coverImage: /blog/bitcoin-cover.jpg
tags:
  - bitcoin
  - tutorial
  - beginners
featured: true
---

# Getting Started with Bitcoin

Your content here...
```

## Markdown Features

The blog supports standard Markdown plus:

- **Headers** (h1-h6)
- **Bold** and *italic* text
- `Inline code` and code blocks with syntax highlighting
- [Links](https://example.com)
- ![Images](/path/to/image.jpg)
- > Blockquotes
- Lists (ordered and unordered)
- Tables

## Images

Place images in `/public/blog/` and reference them with absolute paths:

```markdown
![Alt text](/blog/my-image.jpg)
```

## Tags

Tags help organize content and enable filtering. Common tags:
- `bitcoin`, `ethereum`, `altcoins`
- `tutorial`, `guide`, `education`
- `api`, `development`, `tools`
- `analysis`, `trading`, `news`
- `announcement`, `update`, `release`

## URL Structure

- Blog listing: `/blog`
- Individual posts: `/blog/[slug]`
- Tag pages: `/blog/tag/[tag]`

## Tips

1. Use descriptive slugs (filenames) for SEO
2. Keep excerpts under 160 characters
3. Add a cover image for better visual appeal
4. Use 3-5 relevant tags per post
5. Mark drafts with `draft: true` while working
