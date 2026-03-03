/**
 * Currency Extractor
 * 
 * Adapted from crypto-news-rag ModelCurrencyExtractor.java and StaticCurrencyExtractor.java
 * Extracts cryptocurrency mentions from user queries using both LLM and static matching.
 */

import { callGroq } from '../groq';
import { VALID_CODES, CRYPTO_ALIASES, NAME_TO_CODE, normalizeToCode } from './known-cryptos';

/**
 * Extract currencies from user query using LLM
 */
export async function extractCurrenciesWithLLM(query: string): Promise<string[]> {
  const prompt = `Extract any cryptocurrencies mentioned in the user query. Return a list — one item per line — containing either the abbreviation (e.g., BTC) or the full name (e.g., Bitcoin), whichever you can extract. If no specific cryptocurrencies are mentioned, return a single line with ALL.

Return only the output. No explanations, no headers, no extra text.

Examples:

User query:
"What is going on with Bitcoin, Ethereum, and Solana?"
Output:
Bitcoin
ETH
SOL

User query:
"What's the market outlook for this year?"
Output:
ALL

Now extract for this query:
${query}`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], {
      temperature: 0.1,
      maxTokens: 256,
    });

    const content = response.content.trim();
    
    if (!content || content === 'ALL') {
      return [];
    }

    return content
      .split(/\r\n|\r|\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && line !== 'ALL');
  } catch (error) {
    console.warn('LLM currency extraction failed:', error);
    return [];
  }
}

/**
 * Extract currencies using static pattern matching
 * Finds exact matches of crypto codes and names in the query
 */
export function extractCurrenciesStatic(query: string): string[] {
  const extractedCodes = new Set<string>();
  const upperQuery = query.toUpperCase();
  
  // Split query into words for exact matching
  const words = upperQuery.split(/[\s.,;:!?()[\]{}'"]+/);
  
  for (const word of words) {
    if (!word) continue;
    
    // Check if word is a valid crypto code
    if (VALID_CODES.has(word)) {
      extractedCodes.add(word);
    }
    
    // Check aliases
    if (CRYPTO_ALIASES[word]) {
      extractedCodes.add(CRYPTO_ALIASES[word]);
    }
    
    // Check name to code mapping
    if (NAME_TO_CODE[word]) {
      extractedCodes.add(NAME_TO_CODE[word]);
    }
  }
  
  // Also check for multi-word names like "Bitcoin Cash"
  for (const [alias, code] of Object.entries(CRYPTO_ALIASES)) {
    if (alias.includes(' ') && upperQuery.includes(alias)) {
      extractedCodes.add(code);
    }
  }
  
  return Array.from(extractedCodes);
}

/**
 * Convert extracted names/codes to valid codes
 * Validates and normalizes the LLM output against known cryptos
 */
export function convertToCodes(currencies: string[]): string[] {
  const codes = new Set<string>();
  
  for (const currency of currencies) {
    const code = normalizeToCode(currency);
    if (code) {
      codes.add(code);
    }
  }
  
  return Array.from(codes);
}

/**
 * Main currency extraction function
 * Combines LLM extraction with static validation
 */
export async function extractCurrencies(query: string): Promise<string[]> {
  // First try LLM extraction
  const llmExtracted = await extractCurrenciesWithLLM(query);
  
  // Validate LLM results against known cryptos
  const refinedCodes = convertToCodes(llmExtracted);
  
  // If LLM found nothing valid, fall back to static extraction
  if (refinedCodes.length === 0) {
    return extractCurrenciesStatic(query);
  }
  
  return refinedCodes;
}

/**
 * Sync version using only static extraction (for when LLM is not needed)
 */
export function extractCurrenciesSync(query: string): string[] {
  return extractCurrenciesStatic(query);
}
