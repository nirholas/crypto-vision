# Phase 5.1: Multi-lingual RAG Support

**Priority:** Medium | **Effort:** 4-5 days | **Impact:** High (Priority Score: 7)  
**Dependency:** None

---

## Objective

Enable cross-lingual retrieval and response generation so users can query in any language and get accurate answers. Support 100+ languages via multilingual embeddings and translation, with special handling for RTL languages (Arabic, Hebrew, Persian, Urdu). Leverage existing next-intl i18n infrastructure.

---

## Implementation Prompt

> Add multi-lingual support to the RAG system in `src/lib/rag/`. Implement language detection, multilingual embeddings (mE5/LaBSE), query/response translation, and RTL layout support. The app already uses next-intl for i18n with 100+ locales configured in `src/proxy.ts`. Archive articles are primarily in English.

### Files to Create

```
src/lib/rag/multilingual/
├── index.ts                    # Public exports
├── types.ts                    # LanguageDetection, TranslationResult, etc.
├── language-detector.ts        # Detect query language (fasttext/CLD3 or LLM)
├── multilingual-embeddings.ts  # mE5-large or LaBSE embedding adapter
├── query-translator.ts         # Translate non-English queries to English for search
├── response-translator.ts      # Translate English answers to user's language
├── rtl-handler.ts              # RTL formatting, bidirectional text handling
└── multilingual-rag-service.ts # Orchestrator wrapping ultimate-rag-service
```

### API Changes

```
POST /api/rag/ask
  Extended body fields:
  {
    query: string,
    inputLanguage?: string,    // ISO 639-1 code or 'auto' (default: 'auto')  
    outputLanguage?: string,   // ISO 639-1 code (default: same as detected input)
    crossLingual?: boolean     // Enable cross-lingual search (default: true)
  }
  
  Extended response:
  {
    answer: string,
    detectedLanguage: string,
    translatedQuery?: string,  // English translation used for search (if non-EN)
    outputLanguage: string,
    ...existing RAGResponse fields
  }
```

### Type Definitions

```typescript
interface LanguageDetection {
  language: string;           // ISO 639-1 code
  confidence: number;         // 0-1
  script: 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'devanagari' | 'other';
  isRTL: boolean;
  name: string;               // Human-readable: "Spanish", "Arabic", etc.
}

interface TranslationResult {
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  provider: 'openai' | 'deepl' | 'google' | 'local';
}

interface MultilingualEmbeddingConfig {
  model: 'mE5-large' | 'LaBSE' | 'multilingual-e5-large-instruct';
  dimensions: number;          // mE5: 1024, LaBSE: 768
  maxSequenceLength: number;
  supportedLanguages: string[];
}

interface MultilingualRAGOptions extends RAGQueryOptions {
  inputLanguage?: string;
  outputLanguage?: string;
  crossLingual?: boolean;
  preserveOriginalQuery?: boolean;
}
```

### Key Implementation Details

1. **Language Detection** (`language-detector.ts`):
   - Primary: Use heuristic detection (Unicode script analysis + common word frequency)
   - Fallback: LLM-based detection for ambiguous cases (costs 1 API call)
   - Cache detections per session to avoid repeated analysis
   - Map language code to RTL flag: `['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi']`
   - Return confidence score — if < 0.7, fall back to English

2. **Multilingual Embeddings** (`multilingual-embeddings.ts`):
   - Use `multilingual-e5-large-instruct` via Hugging Face Inference API
   - Fallback: Use OpenAI `text-embedding-3-small` which has decent multilingual support
   - Embed queries in their original language (no translation needed for embedding)
   - Store flag in vector metadata: `embeddingModel: 'multilingual'` vs `'english-only'`
   - Gradual migration: new documents get multilingual embeddings, old ones keep existing

3. **Query Translation** (`query-translator.ts`):
   - Translate non-English queries to English for BM25 keyword search (hybrid-search.ts)
   - Use LLM (Groq/OpenAI) for translation — cheaper and more accurate for crypto terminology
   - Preserve crypto-specific terms: "Bitcoin", "Ethereum", "DeFi" should not be translated
   - Keep original query for embedding search, translated query for BM25
   - Cache translations: `translation:{lang}:{queryHash}` → 24h TTL

4. **Response Translation** (`response-translator.ts`):
   - Translate final English answer to user's desired output language
   - Use LLM with domain-specific prompt: "Translate this crypto news answer to {language}. Preserve technical terms, ticker symbols, and numbers exactly."
   - Include source URLs without translation
   - For CJK languages: adjust formatting (no Oxford commas, use appropriate date formats)

5. **RTL Support** (`rtl-handler.ts`):
   - Wrap RTL responses with Unicode directional marks (U+200F RLM)
   - Handle bidirectional text (English terms within Arabic text)
   - Format numbers correctly (Arabic-Indic numerals optional)
   - Coordinate with front-end `dir="rtl"` attr (already in next-intl layout)

6. **Integration with existing i18n**:
   - Map next-intl locale to ISO 639-1 for RAG language detection
   - Use `messages/{locale}.json` for UI strings around RAG (like "Searching...", "No results found")
   - Default output language matches the user's current locale from URL `/[locale]/`

### Performance Considerations

- Multilingual embeddings are ~2x slower than English-only — cache aggressively
- Translation adds ~200-400ms per query — pipeline in parallel with search
- Keep English-only search path for `en` queries (no overhead)
- Budget: ~$0.001 per translated query (Groq), ~$0.005 (OpenAI)

### Testing

- Unit tests: language detection accuracy (test 20+ languages), translation preservation of crypto terms
- Integration test: Spanish query → English search → Spanish response with correct sources
- RTL test: Arabic query produces correctly formatted bidirectional response
- Edge cases: mixed-language query ("Bitcoin في"), rare languages, emoji-heavy queries
