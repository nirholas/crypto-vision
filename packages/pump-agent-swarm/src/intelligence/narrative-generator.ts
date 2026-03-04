/**
 * Advanced Narrative Generator — Multi-narrative generation, virality ranking,
 * trend alignment, and image generation for token launches.
 *
 * Features:
 * - Generate N narrative options via real OpenRouter LLM calls
 * - Rank narratives by predicted virality using a second LLM pass
 * - Align narratives with detected category trends
 * - Generate token images via OpenAI DALL-E 3 or Stability AI
 * - Refine narratives based on feedback
 * - Track history to avoid repetition across sessions
 */

import { v4 as uuidv4 } from 'uuid';

import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ────────────────────────────────────────────────────

export interface NarrativeGeneratorConfig {
  /** OpenRouter API key */
  openRouterApiKey: string;
  /** Groq API key for fallback AI inference */
  groqApiKey?: string;
  /** Model for narrative generation */
  narrativeModel: string;
  /** Image generation API key (OpenAI or Stability) */
  imageApiKey?: string;
  /** Image generation provider */
  imageProvider: 'openai' | 'stability';
  /** OpenAI image API base */
  openaiApiBase: string;
  /** Stability AI base */
  stabilityApiBase: string;
  /** Temperature for creative generation */
  temperature: number;
  /** Track history to avoid repetition */
  avoidRepetition: boolean;
}

export interface NarrativeConstraints {
  /** Target category */
  targetCategory?: string;
  /** Categories to explicitly avoid */
  avoidCategories?: string[];
  /** Must-include keywords */
  mustInclude?: string[];
  /** Tone of the narrative */
  tone?: 'funny' | 'serious' | 'edgy' | 'wholesome' | 'absurd' | 'professional';
  /** Max character length for name */
  maxNameLength?: number;
  /** Max ticker length */
  maxTickerLength?: number;
  /** Current trending themes to incorporate */
  trendingThemes?: string[];
  /** Narratives to avoid (already used) */
  avoidNarratives?: string[];
}

export interface GeneratorTokenNarrative {
  /** Token name */
  name: string;
  /** Token ticker/symbol */
  ticker: string;
  /** Token description (for Pump.fun listing) */
  description: string;
  /** Category */
  category: string;
  /** Narrative thesis: why would people buy this? */
  thesis: string;
  /** Meme potential (0-100) */
  memePotential: number;
  /** Target audience */
  targetAudience: string;
  /** Image prompt (for image generation) */
  imagePrompt: string;
  /** Generated image data (populated by generateImage) */
  imageData?: Buffer;
  /** Social media hooks: tweet-ready descriptions */
  socialHooks: string[];
  /** Hashtags */
  hashtags: string[];
}

export interface ViralityFactors {
  /** Is the name catchy, memorable, searchable? */
  nameQuality: number;
  /** Is the ticker short, pronounceable? */
  tickerQuality: number;
  /** How easily can this become a meme? */
  memeability: number;
  /** Does it match current trends? */
  trendAlignment: number;
  /** Is this different from recent launches? */
  uniqueness: number;
  /** Controversial = viral (but risky) */
  controversyFactor: number;
}

export interface RankedNarrative {
  narrative: GeneratorTokenNarrative;
  /** Rank position (1 = best) */
  rank: number;
  /** Predicted virality score (0-100) */
  viralityScore: number;
  /** Virality factors */
  factors: ViralityFactors;
  /** LLM reasoning for the ranking */
  reasoning: string;
}

export interface CategoryTrend {
  /** Category name */
  category: string;
  /** Trend strength (0-100) */
  strength: number;
  /** Trending keywords in this category */
  keywords: string[];
  /** Trend description */
  description: string;
}

// ─── Constants ────────────────────────────────────────────────

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_FALLBACK_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct';
const DEFAULT_TEMPERATURE = 0.9;
const DEFAULT_MAX_TICKER_LENGTH = 10;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const MAX_HISTORY_SIZE = 500;
const LLM_TIMEOUT_MS = 90_000;
const IMAGE_TIMEOUT_MS = 120_000;

// ─── System Prompts ───────────────────────────────────────────

const NARRATIVE_GENERATION_SYSTEM = `You are a crypto memecoin narrative expert. Generate token names and narratives that will go viral on Crypto Twitter and Pump.fun. You understand what makes a memecoin successful: catchy name, relatable theme, cultural relevance, and memeable imagery. Your narratives should be creative, timely, and have potential for community formation.

You MUST respond with valid JSON only. No markdown, no code fences, no extra text.`;

const VIRALITY_RANKING_SYSTEM = `You are a crypto market analyst who predicts which memecoins will gain traction. Rank the following token narratives by predicted virality. Consider: name catchiness, cultural relevance, meme potential, ticker quality, and uniqueness. Score each factor 0-100 and provide overall ranking.

You MUST respond with valid JSON only. No markdown, no code fences, no extra text.`;

const TREND_ALIGNMENT_SYSTEM = `You are a crypto trend analyst. Given a token narrative and a list of current trending themes, adjust the narrative to better incorporate those trends while maintaining its core identity. The adjustment should feel natural, not forced.

You MUST respond with valid JSON only. No markdown, no code fences, no extra text.`;

const REFINEMENT_SYSTEM = `You are a crypto narrative refinement specialist. Given a token narrative and specific feedback, improve the narrative while maintaining what works. Apply the feedback precisely and enhance the overall quality.

You MUST respond with valid JSON only. No markdown, no code fences, no extra text.`;

// ─── Default Config ───────────────────────────────────────────

const DEFAULT_CONFIG: Omit<NarrativeGeneratorConfig, 'openRouterApiKey'> = {
  narrativeModel: DEFAULT_MODEL,
  imageProvider: 'openai',
  openaiApiBase: 'https://api.openai.com/v1',
  stabilityApiBase: 'https://api.stability.ai/v1',
  temperature: DEFAULT_TEMPERATURE,
  avoidRepetition: true,
};

// ─── Narrative Generator ──────────────────────────────────────

export class NarrativeGenerator {
  private readonly config: NarrativeGeneratorConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private readonly history: GeneratorTokenNarrative[] = [];
  private readonly correlationId: string;

  constructor(config: NarrativeGeneratorConfig, eventBus: SwarmEventBus) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = eventBus;
    this.correlationId = uuidv4();
    this.logger = SwarmLogger.create('narrative-generator', 'intelligence');

    this.logger.info('NarrativeGenerator initialized', {
      model: this.config.narrativeModel,
      imageProvider: this.config.imageProvider,
      avoidRepetition: this.config.avoidRepetition,
    });
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Generate N narrative options with optional constraints.
   * Each narrative is a complete token concept ready for launch.
   */
  async generateNarratives(
    count: number,
    constraints?: NarrativeConstraints,
  ): Promise<GeneratorTokenNarrative[]> {
    const effectiveCount = Math.max(1, Math.min(count, 20));
    this.logger.info('Generating narratives', { count: effectiveCount, constraints });

    this.eventBus.emit(
      'narrative-generator:generating',
      'intelligence',
      'narrative-generator',
      { count: effectiveCount, constraints },
      this.correlationId,
    );

    const userPrompt = this.buildGenerationPrompt(effectiveCount, constraints);
    const raw = await this.callOpenRouter(
      NARRATIVE_GENERATION_SYSTEM,
      userPrompt,
      this.config.temperature,
    );

    const parsed = this.parseJsonResponse<{
      narratives: Array<Record<string, unknown>>;
    }>(raw);

    if (!parsed.narratives || !Array.isArray(parsed.narratives)) {
      throw new Error('LLM response missing narratives array');
    }

    const maxTickerLen = constraints?.maxTickerLength ?? DEFAULT_MAX_TICKER_LENGTH;
    const maxNameLen = constraints?.maxNameLength ?? 30;

    const narratives: GeneratorTokenNarrative[] = parsed.narratives
      .slice(0, effectiveCount)
      .map((raw) => this.normalizeNarrative(raw, maxNameLen, maxTickerLen));

    // Post-process: enforce constraints
    const filtered = this.enforceConstraints(narratives, constraints);

    // Track history for repetition avoidance
    if (this.config.avoidRepetition) {
      for (const n of filtered) {
        this.addToHistory(n);
      }
    }

    this.eventBus.emit(
      'narrative-generator:generated',
      'intelligence',
      'narrative-generator',
      { count: filtered.length, names: filtered.map((n) => n.name) },
      this.correlationId,
    );

    this.logger.info('Narratives generated', {
      requested: effectiveCount,
      produced: filtered.length,
      names: filtered.map((n) => `${n.name} ($${n.ticker})`),
    });

    return filtered;
  }

  /**
   * Rank narratives by predicted virality using a second LLM pass.
   * Returns narratives sorted by rank (1 = best).
   */
  async rankNarratives(narratives: GeneratorTokenNarrative[]): Promise<RankedNarrative[]> {
    if (narratives.length === 0) return [];
    if (narratives.length === 1) {
      return [{
        narrative: narratives[0],
        rank: 1,
        viralityScore: narratives[0].memePotential,
        factors: {
          nameQuality: 50,
          tickerQuality: 50,
          memeability: narratives[0].memePotential,
          trendAlignment: 50,
          uniqueness: 50,
          controversyFactor: 20,
        },
        reasoning: 'Single narrative — no comparison needed.',
      }];
    }

    this.logger.info('Ranking narratives', { count: narratives.length });

    this.eventBus.emit(
      'narrative-generator:ranking',
      'intelligence',
      'narrative-generator',
      { count: narratives.length },
      this.correlationId,
    );

    const narrativeSummaries = narratives.map((n, i) => ({
      index: i,
      name: n.name,
      ticker: n.ticker,
      description: n.description,
      category: n.category,
      thesis: n.thesis,
      memePotential: n.memePotential,
      targetAudience: n.targetAudience,
      socialHooks: n.socialHooks,
      hashtags: n.hashtags,
    }));

    const userPrompt = `Rank these ${narratives.length} token narratives by predicted virality. For each narrative, provide:
- viralityScore (0-100 overall)
- factors: nameQuality, tickerQuality, memeability, trendAlignment, uniqueness, controversyFactor (each 0-100)
- reasoning: 1-2 sentence explanation

Narratives to rank:
${JSON.stringify(narrativeSummaries, null, 2)}

Respond with JSON:
{
  "rankings": [
    {
      "index": 0,
      "viralityScore": 85,
      "factors": {
        "nameQuality": 90,
        "tickerQuality": 85,
        "memeability": 80,
        "trendAlignment": 75,
        "uniqueness": 90,
        "controversyFactor": 30
      },
      "reasoning": "Strong name with high meme potential..."
    }
  ]
}

Sort rankings from highest viralityScore to lowest.`;

    // Use lower temperature for analytical ranking
    const raw = await this.callOpenRouter(VIRALITY_RANKING_SYSTEM, userPrompt, 0.3);
    const parsed = this.parseJsonResponse<{
      rankings: Array<{
        index: number;
        viralityScore: number;
        factors: Record<string, number>;
        reasoning: string;
      }>;
    }>(raw);

    if (!parsed.rankings || !Array.isArray(parsed.rankings)) {
      throw new Error('LLM ranking response missing rankings array');
    }

    const ranked: RankedNarrative[] = parsed.rankings
      .filter((r) => r.index >= 0 && r.index < narratives.length)
      .sort((a, b) => (b.viralityScore ?? 0) - (a.viralityScore ?? 0))
      .map((r, position) => ({
        narrative: narratives[r.index],
        rank: position + 1,
        viralityScore: clamp(r.viralityScore ?? 0, 0, 100),
        factors: {
          nameQuality: clamp(r.factors?.nameQuality ?? 50, 0, 100),
          tickerQuality: clamp(r.factors?.tickerQuality ?? 50, 0, 100),
          memeability: clamp(r.factors?.memeability ?? 50, 0, 100),
          trendAlignment: clamp(r.factors?.trendAlignment ?? 50, 0, 100),
          uniqueness: clamp(r.factors?.uniqueness ?? 50, 0, 100),
          controversyFactor: clamp(r.factors?.controversyFactor ?? 20, 0, 100),
        },
        reasoning: r.reasoning ?? 'No reasoning provided.',
      }));

    // If some narratives were missing from LLM response, add them at the end
    const rankedIndices = new Set(parsed.rankings.map((r) => r.index));
    let nextRank = ranked.length + 1;
    for (let i = 0; i < narratives.length; i++) {
      if (!rankedIndices.has(i)) {
        ranked.push({
          narrative: narratives[i],
          rank: nextRank++,
          viralityScore: narratives[i].memePotential,
          factors: {
            nameQuality: 50,
            tickerQuality: 50,
            memeability: narratives[i].memePotential,
            trendAlignment: 50,
            uniqueness: 50,
            controversyFactor: 20,
          },
          reasoning: 'Not included in LLM ranking response — default scores applied.',
        });
      }
    }

    this.eventBus.emit(
      'narrative-generator:ranked',
      'intelligence',
      'narrative-generator',
      {
        rankings: ranked.map((r) => ({
          name: r.narrative.name,
          rank: r.rank,
          viralityScore: r.viralityScore,
        })),
      },
      this.correlationId,
    );

    this.logger.info('Narratives ranked', {
      top: ranked[0]
        ? `${ranked[0].narrative.name} (${ranked[0].viralityScore})`
        : 'none',
      count: ranked.length,
    });

    return ranked;
  }

  /**
   * Adjust a narrative to better match current category trends.
   * Keeps the core identity while incorporating trending themes.
   */
  async alignWithTrends(
    narrative: GeneratorTokenNarrative,
    trends: CategoryTrend[],
  ): Promise<GeneratorTokenNarrative> {
    if (trends.length === 0) return narrative;

    this.logger.info('Aligning narrative with trends', {
      name: narrative.name,
      trendCount: trends.length,
    });

    this.eventBus.emit(
      'narrative-generator:aligning',
      'intelligence',
      'narrative-generator',
      {
        name: narrative.name,
        trends: trends.map((t) => t.category),
      },
      this.correlationId,
    );

    const trendSummary = trends
      .sort((a, b) => b.strength - a.strength)
      .map((t) => `- ${t.category} (strength: ${t.strength}/100): ${t.description}. Keywords: ${t.keywords.join(', ')}`)
      .join('\n');

    const userPrompt = `Current narrative:
${JSON.stringify(narrativeToJson(narrative), null, 2)}

Current trending themes:
${trendSummary}

Adjust this narrative to incorporate the most relevant trending themes while maintaining its core identity. If "AI agents" is trending and the narrative is about a dog, keep the dog but add an AI angle. Don't force unrelated trends.

Respond with the adjusted narrative JSON:
{
  "name": "...",
  "ticker": "...",
  "description": "...",
  "category": "...",
  "thesis": "...",
  "memePotential": 0-100,
  "targetAudience": "...",
  "imagePrompt": "...",
  "socialHooks": ["..."],
  "hashtags": ["..."]
}`;

    const raw = await this.callOpenRouter(TREND_ALIGNMENT_SYSTEM, userPrompt, 0.7);
    const parsed = this.parseJsonResponse<Record<string, unknown>>(raw);
    const aligned = this.normalizeNarrative(parsed, 30, DEFAULT_MAX_TICKER_LENGTH);

    this.eventBus.emit(
      'narrative-generator:aligned',
      'intelligence',
      'narrative-generator',
      { originalName: narrative.name, alignedName: aligned.name },
      this.correlationId,
    );

    this.logger.info('Narrative aligned with trends', {
      originalName: narrative.name,
      alignedName: aligned.name,
      alignedCategory: aligned.category,
    });

    return aligned;
  }

  /**
   * Generate a token image using OpenAI DALL-E 3 or Stability AI.
   * Returns the raw image buffer.
   */
  async generateImage(narrative: GeneratorTokenNarrative): Promise<Buffer> {
    const provider = this.config.imageProvider;
    this.logger.info('Generating image', {
      name: narrative.name,
      provider,
    });

    this.eventBus.emit(
      'narrative-generator:image-generating',
      'intelligence',
      'narrative-generator',
      { name: narrative.name, provider },
      this.correlationId,
    );

    const imagePrompt = narrative.imagePrompt || `Crypto token logo for ${narrative.name} ($${narrative.ticker}): ${narrative.description}`;

    let imageBuffer: Buffer;

    if (provider === 'openai') {
      imageBuffer = await this.generateImageOpenAI(imagePrompt);
    } else {
      imageBuffer = await this.generateImageStability(imagePrompt);
    }

    this.eventBus.emit(
      'narrative-generator:image-generated',
      'intelligence',
      'narrative-generator',
      { name: narrative.name, sizeBytes: imageBuffer.length },
      this.correlationId,
    );

    this.logger.info('Image generated', {
      name: narrative.name,
      sizeBytes: imageBuffer.length,
    });

    return imageBuffer;
  }

  /**
   * Iterate on a narrative based on specific feedback.
   * Uses LLM to refine while preserving what works.
   */
  async refineNarrative(
    narrative: GeneratorTokenNarrative,
    feedback: string,
  ): Promise<GeneratorTokenNarrative> {
    this.logger.info('Refining narrative', {
      name: narrative.name,
      feedbackLength: feedback.length,
    });

    this.eventBus.emit(
      'narrative-generator:refining',
      'intelligence',
      'narrative-generator',
      { name: narrative.name, feedback },
      this.correlationId,
    );

    const userPrompt = `Current narrative:
${JSON.stringify(narrativeToJson(narrative), null, 2)}

Feedback to incorporate:
${feedback}

Refine the narrative based on this feedback. Improve what was criticized while keeping what works. The refined narrative should be strictly better.

Respond with the refined narrative JSON:
{
  "name": "...",
  "ticker": "...",
  "description": "...",
  "category": "...",
  "thesis": "...",
  "memePotential": 0-100,
  "targetAudience": "...",
  "imagePrompt": "...",
  "socialHooks": ["..."],
  "hashtags": ["..."]
}`;

    const raw = await this.callOpenRouter(REFINEMENT_SYSTEM, userPrompt, 0.7);
    const parsed = this.parseJsonResponse<Record<string, unknown>>(raw);
    const refined = this.normalizeNarrative(parsed, 30, DEFAULT_MAX_TICKER_LENGTH);

    if (this.config.avoidRepetition) {
      this.addToHistory(refined);
    }

    this.eventBus.emit(
      'narrative-generator:refined',
      'intelligence',
      'narrative-generator',
      { originalName: narrative.name, refinedName: refined.name },
      this.correlationId,
    );

    this.logger.info('Narrative refined', {
      originalName: narrative.name,
      refinedName: refined.name,
      refinedMemePotential: refined.memePotential,
    });

    return refined;
  }

  /**
   * Return all previously generated narratives for this session.
   */
  getNarrativeHistory(): GeneratorTokenNarrative[] {
    return [...this.history];
  }

  // ─── OpenRouter LLM ────────────────────────────────────────

  /**
   * Call OpenRouter chat completions API with retry logic, exponential backoff,
   * and Groq fallback when all OpenRouter retries are exhausted.
   */
  private async callOpenRouter(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.callLLMProvider(
          `${OPENROUTER_API_BASE}/chat/completions`,
          this.config.openRouterApiKey,
          this.config.narrativeModel,
          systemPrompt,
          userPrompt,
          temperature,
          { 'HTTP-Referer': 'https://pump.fun', 'X-Title': 'PumpAgentSwarm-NarrativeGenerator' },
        );
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`OpenRouter call failed (attempt ${attempt + 1}/${MAX_RETRIES})`, {
          error: lastError.message,
          model: this.config.narrativeModel,
        });

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    // Groq fallback — if a key is configured, try once before giving up
    if (this.config.groqApiKey) {
      this.logger.info('Attempting Groq fallback after OpenRouter exhaustion');
      try {
        return await this.callLLMProvider(
          GROQ_API_BASE,
          this.config.groqApiKey,
          GROQ_FALLBACK_MODEL,
          systemPrompt,
          userPrompt,
          temperature,
          {},
        );
      } catch (groqErr) {
        this.logger.warn('Groq fallback also failed', {
          error: groqErr instanceof Error ? groqErr.message : String(groqErr),
        });
      }
    }

    const finalError = lastError ?? new Error('OpenRouter call failed after retries');
    this.eventBus.emit(
      'narrative-generator:error',
      'error',
      'narrative-generator',
      { error: finalError.message },
      this.correlationId,
    );
    throw finalError;
  }

  /** Generic LLM provider call (OpenRouter or Groq compatible) */
  private async callLLMProvider(
    url: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    extraHeaders: Record<string, string>,
  ): Promise<string> {
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('LLM provider returned empty response');
    }

    return content;
  }

  // ─── Image Generation ──────────────────────────────────────

  /**
   * Generate image via OpenAI DALL-E 3.
   */
  private async generateImageOpenAI(prompt: string): Promise<Buffer> {
    const apiKey = this.config.imageApiKey;
    if (!apiKey) {
      throw new Error('imageApiKey is required for OpenAI image generation');
    }

    const response = await fetch(`${this.config.openaiApiBase}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`DALL-E API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const b64 = data.data?.[0]?.b64_json;

    if (!b64) {
      throw new Error('DALL-E returned no image data');
    }

    return Buffer.from(b64, 'base64');
  }

  /**
   * Generate image via Stability AI (SDXL).
   */
  private async generateImageStability(prompt: string): Promise<Buffer> {
    const apiKey = this.config.imageApiKey;
    if (!apiKey) {
      throw new Error('imageApiKey is required for Stability AI image generation');
    }

    const response = await fetch(
      `${this.config.stabilityApiBase}/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt.slice(0, 2000), weight: 1 }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
        }),
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Stability AI error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      artifacts?: Array<{ base64?: string; finishReason?: string }>;
    };
    const artifact = data.artifacts?.[0];

    if (!artifact?.base64) {
      throw new Error('Stability AI returned no image data');
    }

    if (artifact.finishReason !== 'SUCCESS' && artifact.finishReason !== undefined) {
      this.logger.warn('Stability AI image generation did not finish successfully', {
        finishReason: artifact.finishReason,
      });
    }

    return Buffer.from(artifact.base64, 'base64');
  }

  // ─── Prompt Building ───────────────────────────────────────

  private buildGenerationPrompt(
    count: number,
    constraints?: NarrativeConstraints,
  ): string {
    const parts: string[] = [];

    parts.push(`Generate exactly ${count} unique token narrative(s) for Pump.fun memecoin launches.`);

    if (constraints?.targetCategory) {
      parts.push(`Target category: ${constraints.targetCategory}`);
    }

    if (constraints?.avoidCategories?.length) {
      parts.push(`Avoid these categories: ${constraints.avoidCategories.join(', ')}`);
    }

    if (constraints?.mustInclude?.length) {
      parts.push(`Must include these keywords or themes: ${constraints.mustInclude.join(', ')}`);
    }

    if (constraints?.tone) {
      const toneDescriptions: Record<NonNullable<NarrativeConstraints['tone']>, string> = {
        funny: 'Humorous and entertaining — make people laugh',
        serious: 'Professional and credible — think legitimate project',
        edgy: 'Edgy and provocative — push boundaries, be controversial',
        wholesome: 'Wholesome and positive — feel-good community vibes',
        absurd: 'Absurd and surreal — the weirder the better',
        professional: 'Polished and institutional — think fund-worthy',
      };
      parts.push(`Tone: ${toneDescriptions[constraints.tone]}`);
    }

    if (constraints?.maxNameLength) {
      parts.push(`Maximum name length: ${constraints.maxNameLength} characters`);
    }

    const maxTicker = constraints?.maxTickerLength ?? DEFAULT_MAX_TICKER_LENGTH;
    parts.push(`Maximum ticker length: ${maxTicker} characters`);

    if (constraints?.trendingThemes?.length) {
      parts.push(`Current trending themes to potentially incorporate: ${constraints.trendingThemes.join(', ')}`);
    }

    // Repetition avoidance
    const avoidList: string[] = [];
    if (constraints?.avoidNarratives?.length) {
      avoidList.push(...constraints.avoidNarratives);
    }
    if (this.config.avoidRepetition && this.history.length > 0) {
      const recentNames = this.history
        .slice(-50)
        .map((n) => `${n.name} ($${n.ticker})`);
      avoidList.push(...recentNames);
    }
    if (avoidList.length > 0) {
      parts.push(`AVOID these previously used concepts/names: ${avoidList.join(', ')}`);
    }

    parts.push(`For each narrative, provide:
- name: catchy token name (max ${constraints?.maxNameLength ?? 30} chars)
- ticker: uppercase symbol (max ${maxTicker} chars)
- description: compelling Pump.fun listing description (max 300 chars)
- category: e.g. ai, animal, political, meme, tech, defi, gaming, culture, food, sports
- thesis: why would people buy this? (1-2 sentences)
- memePotential: 0-100 score
- targetAudience: who will buy this
- imagePrompt: detailed AI art prompt for token logo
- socialHooks: 3-5 tweet-ready descriptions
- hashtags: 3-5 relevant hashtags (include #)

Respond with JSON:
{
  "narratives": [
    {
      "name": "...",
      "ticker": "...",
      "description": "...",
      "category": "...",
      "thesis": "...",
      "memePotential": 85,
      "targetAudience": "...",
      "imagePrompt": "...",
      "socialHooks": ["...", "..."],
      "hashtags": ["#...", "#..."]
    }
  ]
}`);

    return parts.join('\n\n');
  }

  // ─── Normalization & Validation ─────────────────────────────

  /**
   * Normalize raw LLM output into a valid GeneratorTokenNarrative.
   */
  private normalizeNarrative(
    raw: Record<string, unknown>,
    maxNameLen: number,
    maxTickerLen: number,
  ): GeneratorTokenNarrative {
    const name = String(raw['name'] ?? 'UnnamedToken').slice(0, maxNameLen);
    const ticker = String(raw['ticker'] ?? raw['symbol'] ?? 'NOTKN')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, maxTickerLen);

    const description = String(raw['description'] ?? '').slice(0, 300);
    const category = String(raw['category'] ?? 'meme').toLowerCase();
    const thesis = String(raw['thesis'] ?? raw['reasoning'] ?? '');
    const memePotential = clamp(Number(raw['memePotential'] ?? raw['meme_potential'] ?? 50), 0, 100);
    const targetAudience = String(raw['targetAudience'] ?? raw['target_audience'] ?? 'Crypto degens');
    const imagePrompt = String(raw['imagePrompt'] ?? raw['image_prompt'] ?? `Logo for ${name} crypto token`);

    const rawHooks = raw['socialHooks'] ?? raw['social_hooks'] ?? [];
    const socialHooks = Array.isArray(rawHooks)
      ? rawHooks.map((h) => String(h)).filter((h) => h.length > 0)
      : [];

    const rawHashtags = raw['hashtags'] ?? [];
    const hashtags = Array.isArray(rawHashtags)
      ? rawHashtags
          .map((h) => String(h))
          .map((h) => (h.startsWith('#') ? h : `#${h}`))
          .filter((h) => h.length > 1)
      : [];

    return {
      name,
      ticker,
      description,
      category,
      thesis,
      memePotential,
      targetAudience,
      imagePrompt,
      socialHooks,
      hashtags,
    };
  }

  /**
   * Enforce constraints on generated narratives, filtering out invalid ones.
   */
  private enforceConstraints(
    narratives: GeneratorTokenNarrative[],
    constraints?: NarrativeConstraints,
  ): GeneratorTokenNarrative[] {
    if (!constraints) return narratives;

    return narratives.filter((n) => {
      // Check avoid categories
      if (constraints.avoidCategories?.includes(n.category)) {
        this.logger.debug('Filtered narrative for avoided category', {
          name: n.name,
          category: n.category,
        });
        return false;
      }

      // Check must-include keywords
      if (constraints.mustInclude?.length) {
        const text = `${n.name} ${n.ticker} ${n.description} ${n.thesis}`.toLowerCase();
        const hasRequired = constraints.mustInclude.some((kw) =>
          text.includes(kw.toLowerCase()),
        );
        if (!hasRequired) {
          this.logger.debug('Filtered narrative for missing must-include keywords', {
            name: n.name,
            mustInclude: constraints.mustInclude,
          });
          return false;
        }
      }

      // Check avoid narratives
      if (constraints.avoidNarratives?.length) {
        const lower = constraints.avoidNarratives.map((s) => s.toLowerCase());
        if (lower.includes(n.name.toLowerCase()) || lower.includes(n.ticker.toLowerCase())) {
          this.logger.debug('Filtered narrative matching avoid list', { name: n.name });
          return false;
        }
      }

      return true;
    });
  }

  // ─── History Management ─────────────────────────────────────

  private addToHistory(narrative: GeneratorTokenNarrative): void {
    this.history.push(narrative);
    // Cap history size to prevent unbounded growth
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.splice(0, this.history.length - MAX_HISTORY_SIZE);
    }
  }

  // ─── JSON Parsing ──────────────────────────────────────────

  /**
   * Parse and clean JSON from LLM output, handling common quirks.
   */
  private parseJsonResponse<T>(raw: string): T {
    let cleaned = raw.trim();

    // Strip markdown code fences
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    // Extract JSON object from mixed text
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (parseError) {
      this.logger.error('Failed to parse LLM JSON output', undefined, {
        rawPreview: raw.slice(0, 500),
        cleanedPreview: cleaned.slice(0, 500),
      });
      throw new Error(
        `Failed to parse LLM JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a GeneratorTokenNarrative to a plain JSON-serializable object
 * (strips imageData buffer for LLM prompts).
 */
function narrativeToJson(
  narrative: GeneratorTokenNarrative,
): Record<string, unknown> {
  return {
    name: narrative.name,
    ticker: narrative.ticker,
    description: narrative.description,
    category: narrative.category,
    thesis: narrative.thesis,
    memePotential: narrative.memePotential,
    targetAudience: narrative.targetAudience,
    imagePrompt: narrative.imagePrompt,
    socialHooks: narrative.socialHooks,
    hashtags: narrative.hashtags,
  };
}
