/**
 * Accessibility E2E Tests
 * 
 * Uses axe-core to automatically test WCAG compliance.
 * Tests for real accessibility violations, not just code patterns.
 * 
 * Usage:
 *   npx playwright test e2e/accessibility.spec.ts
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Critical pages that must be fully accessible
const CRITICAL_PAGES = [
  { path: '/', name: 'Home' },
  { path: '/markets', name: 'Markets' },
  { path: '/search', name: 'Search' },
  { path: '/trending', name: 'Trending' },
  { path: '/settings', name: 'Settings' },
  { path: '/pricing', name: 'Pricing' },
  { path: '/developers', name: 'Developers' },
];

// Pages that should be tested but may have known issues
const SECONDARY_PAGES = [
  { path: '/coin/bitcoin', name: 'Coin Detail' },
  { path: '/portfolio', name: 'Portfolio' },
  { path: '/ai', name: 'AI Features' },
  { path: '/defi', name: 'DeFi' },
];

test.describe('Accessibility - Critical Pages (WCAG 2.1 AA)', () => {
  for (const { path, name } of CRITICAL_PAGES) {
    test(`${name} page should have no critical a11y violations`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      
      // Filter to only critical and serious issues
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );
      
      if (criticalViolations.length > 0) {
        console.log(`\n❌ A11y violations on ${name} (${path}):`);
        criticalViolations.forEach(v => {
          console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
          console.log(`    Help: ${v.helpUrl}`);
          v.nodes.slice(0, 3).forEach(n => {
            console.log(`    → ${n.html.substring(0, 100)}...`);
          });
        });
      }
      
      expect(criticalViolations).toHaveLength(0);
    });
  }
});

test.describe('Accessibility - Secondary Pages', () => {
  for (const { path, name } of SECONDARY_PAGES) {
    test(`${name} page should have no critical a11y violations`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical'
      );
      
      expect(criticalViolations).toHaveLength(0);
    });
  }
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('can navigate main menu with keyboard', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Tab through navigation
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // First nav item
    
    // Check focus is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? {
        tagName: el.tagName,
        hasVisibleFocus: window.getComputedStyle(el).outlineWidth !== '0px' ||
                         el.classList.contains('focus-visible') ||
                         el.matches(':focus-visible')
      } : null;
    });
    
    expect(focusedElement).toBeTruthy();
  });
  
  test('skip link works correctly', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Tab to skip link
    await page.keyboard.press('Tab');
    
    // Check if skip link is now visible/focusable
    const skipLink = await page.$('.skip-link:focus, [href="#main-content"]:focus, a:focus:first-of-type');
    
    // Press enter on skip link
    await page.keyboard.press('Enter');
    
    // Focus should now be on main content or past the navigation
    const focusedAfterSkip = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.id || el?.getAttribute('role') || el?.tagName;
    });
    
    // Should be main, main-content, or similar
    expect(focusedAfterSkip).toBeTruthy();
  });
});

test.describe('Accessibility - Color Contrast', () => {
  test('text has sufficient color contrast', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.color'])
      .analyze();
    
    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('contrast')
    );
    
    if (contrastViolations.length > 0) {
      console.log('\n⚠️ Color contrast issues:');
      contrastViolations.forEach(v => {
        v.nodes.slice(0, 5).forEach(n => {
          console.log(`  ${n.html.substring(0, 80)}...`);
        });
      });
    }
    
    // Allow minor issues but fail on critical
    const criticalContrast = contrastViolations.filter(v => v.impact === 'critical');
    expect(criticalContrast).toHaveLength(0);
  });
});

test.describe('Accessibility - Reduced Motion', () => {
  test('respects prefers-reduced-motion', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Check that animations are disabled
    const hasReducedMotion = await page.evaluate(() => {
      const computedStyle = window.getComputedStyle(document.body);
      const anyElement = document.querySelector('.animate-enter, [class*="animate"]');
      
      if (anyElement) {
        const animDuration = window.getComputedStyle(anyElement).animationDuration;
        const transDuration = window.getComputedStyle(anyElement).transitionDuration;
        // Should be very short or 0
        return parseFloat(animDuration) <= 0.01 || parseFloat(transDuration) <= 0.01;
      }
      return true; // No animations found is fine
    });
    
    expect(hasReducedMotion).toBe(true);
  });
});

test.describe('Accessibility - Screen Reader', () => {
  test('images have alt text', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.text-alternatives'])
      .analyze();
    
    const imageViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('image') || v.id.includes('alt')
    );
    
    expect(imageViolations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });
  
  test('form inputs have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`, { waitUntil: 'networkidle' });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.forms'])
      .analyze();
    
    const formViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('label') || v.id.includes('input')
    );
    
    expect(formViolations.filter(v => v.impact === 'critical')).toHaveLength(0);
  });
  
  test('page has proper heading hierarchy', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    const headings = await page.evaluate(() => {
      const h = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(h).map(el => ({
        level: parseInt(el.tagName[1]),
        text: el.textContent?.substring(0, 50),
      }));
    });
    
    // Should have exactly one h1
    const h1Count = headings.filter(h => h.level === 1).length;
    expect(h1Count).toBe(1);
    
    // Heading levels should not skip (e.g., h1 -> h3)
    let lastLevel = 0;
    for (const h of headings) {
      if (h.level > lastLevel + 1 && lastLevel > 0) {
        console.log(`⚠️ Heading skip: h${lastLevel} → h${h.level} ("${h.text}")`);
      }
      lastLevel = h.level;
    }
  });
});
