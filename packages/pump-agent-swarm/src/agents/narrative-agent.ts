/**
 * Narrative Agent — AI-powered token idea generation
 *
 * Generates compelling token names, tickers, descriptions, image prompts,
 * metadata, and social media hooks using real LLM APIs (OpenRouter/OpenAI/Anthropic).
 *
 * Features:
 * - Multi-provider LLM support with automatic fallback
 * - Structured JSON output parsing with validation
 * - IPFS/Arweave metadata upload for Pump.fun
 * - Optional image generation via DALL-E 3 / Stability AI
 * - Theme-aware narrative with trending topic integration
 * - Narrative quality evaluation and scoring
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import type { SwarmEventBus } from '../infra/event-bus.js';
import type { SwarmLogger } from '../infra/logger.js';
import type {
  AgentIdentity,
  IntelligenceConfig,
  TokenNarrative,
} from '../types.js';

// ─── Types ────────────────────────────────────────────────────

export interface NarrativeOptions {
  /** Theme/category to generate around */
  theme?: 'ai' | 'tech' | 'meme' | 'defi' | 'gaming' | 'current-events' | 'random';
  /** Trending topics to incorporate (fetched from Twitter/news) */
  trendingTopics?: string[];
  /** Avoid these names/symbols (already taken) */
  blacklist?: string[];
  /** Target virality level (1-10) */
  viralityTarget?: number;
  /** Whether to aim for a serious project or pure meme */
  tone?: 'serious' | 'meme' | 'satirical' | 'educational';
  /** Custom prompt additions */
  customPrompt?: string;
}

export interface PumpFunMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: boolean;
  createdOn: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface NarrativeEvaluation {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  [key: string]: unknown;
}

interface NarrativeAgentEvents {
  'narrative:generating': (options: NarrativeOptions) => void;
  'narrative:generated': (narrative: TokenNarrative) => void;
  'narrative:evaluated': (evaluation: NarrativeEvaluation) => void;
  'narrative:metadata-uploaded': (uri: string) => void;
  'narrative:error': (error: Error) => void;
}

// ─── LLM Provider Abstraction ─────────────────────────────────

interface LLMCompletionRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature: number;
  max_tokens: number;
  response_format?: { type: 'json_object' };
}

interface LLMProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
}

function resolveProviderConfig(config: IntelligenceConfig): LLMProviderConfig {
  switch (config.llmProvider) {
    case 'openrouter':
      return {
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: config.llmApiKey,
        model: config.llmModel || 'anthropic/claude-sonnet-4',
        headers: {
          'Authorization': `Bearer ${config.llmApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pump.fun',
          'X-Title': 'PumpAgentSwarm',
        },
      };
    case 'openai':
      return {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: config.llmApiKey,
        model: config.llmModel || 'gpt-4o',
        headers: {
          'Authorization': `Bearer ${config.llmApiKey}`,
          'Content-Type': 'application/json',
        },
      };
    case 'anthropic':
      return {
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: config.llmApiKey,
        model: config.llmModel || 'claude-sonnet-4-20250514',
        headers: {
          'x-api-key': config.llmApiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
      };
    default:
      throw new Error(`Unsupported LLM provider: ${config.llmProvider as string}`);
  }
}

// ─── Constants ────────────────────────────────────────────────

const CREATIVITY_TEMPERATURE = 0.9;
const EVALUATION_TEMPERATURE = 0.3;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const MAX_DESCRIPTION_LENGTH = 300;
const DEFAULT_SOCIAL_HOOK_COUNT = 5;

// ─── System Prompts ───────────────────────────────────────────

const NAME_GENERATION_PROMPT = `You are an expert crypto token naming specialist. Generate a memorable, unique, and catchy token name and ticker symbol.

Requirements:
- Name must be 2-20 characters, memorable and easy to spell
- Symbol/ticker must be 2-6 uppercase letters
- Must feel fresh and not copy existing popular tokens (BTC, ETH, SOL, DOGE, PEPE, etc.)
- Consider virality potential — would people share this on Twitter?
- Think about meme culture, crypto culture, and internet trends
- The name should evoke emotions: humor, curiosity, greed, or excitement

Respond ONLY with valid JSON:
{
  "name": "TokenName",
  "symbol": "TICK",
  "reasoning": "Brief explanation of why this name works"
}`;

const DESCRIPTION_GENERATION_PROMPT = `You are a crypto marketing copywriter creating token descriptions for Pump.fun launches.

Requirements:
- Maximum 300 characters
- Structure: hook + value proposition + call to action
- Use crypto/degen slang appropriately
- Create FOMO and excitement
- No financial advice or guaranteed returns language
- Must feel authentic, not corporate

Respond ONLY with valid JSON:
{
  "description": "Your token description here"
}`;

const IMAGE_PROMPT_GENERATION = `You are an AI art director specializing in crypto token artwork. Generate a detailed image prompt for creating token artwork.

Requirements:
- Describe the visual in detail: subject, style, colors, mood, composition
- Target Midjourney/DALL-E style prompts
- Make it distinctive and recognizable at small avatar sizes
- Include style keywords: "digital art", "vibrant", "crypto aesthetic"
- Include technical quality keywords: "high detail", "8k", "trending on artstation"
- The image should work as a token icon/PFP

Respond ONLY with valid JSON:
{
  "imagePrompt": "Your detailed image generation prompt here"
}`;

const SOCIAL_HOOKS_PROMPT = `You are a crypto Twitter (CT) engagement specialist. Generate viral social media hooks for a new token launch.

Requirements:
- Twitter-optimized: punchy, under 280 characters each
- Use appropriate emojis (🚀, 💎, 🔥, etc.) but don't overdo it
- Include 1-2 relevant hashtags per hook
- Mix of engagement types: announcement, FOMO, community, humor
- Reference current crypto meta and degen culture
- Make people want to RT and quote tweet

Respond ONLY with valid JSON:
{
  "hooks": ["Hook 1", "Hook 2", "Hook 3"]
}`;

const NARRATIVE_EVALUATION_PROMPT = `You are a crypto narrative analyst evaluating token launch concepts. Assess the given narrative for viral potential and market success.

Score on a 0-100 scale across these criteria:
- Name memorability (0-25)
- Description quality (0-25)
- Viral potential (0-25)
- Market timing/trend fit (0-25)

Be critical but constructive. Identify specific improvements.

Respond ONLY with valid JSON:
{
  "score": 75,
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "improvements": ["Suggestion 1", "Suggestion 2"]
}`;

const FULL_NARRATIVE_PROMPT = `You are a crypto token narrative architect. Generate a complete token concept that's ready for a Pump.fun launch.

Consider:
- Current crypto meta and trends
- Meme culture and virality
- Community building potential
- Technical/thematic uniqueness
- Target audience appeal

Respond ONLY with valid JSON:
{
  "name": "TokenName",
  "symbol": "TICK",
  "description": "Max 300 chars — hook + value prop + CTA",
  "category": "One of: ai, tech, meme, defi, gaming, current-events, random",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "imagePrompt": "Detailed AI art generation prompt",
  "socialHooks": ["Hook 1", "Hook 2", "Hook 3"],
  "reasoning": "Why this narrative will work — the insight",
  "confidence": 0.85,
  "trendConnections": ["Trend this connects to"],
  "targetAudience": "Who will buy this and why"
}`;

// ─── Narrative Agent ──────────────────────────────────────────

export class NarrativeAgent extends EventEmitter<NarrativeAgentEvents> {
  private readonly config: IntelligenceConfig;
  private readonly provider: LLMProviderConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private readonly agentId: string;
  private readonly correlationId: string;

  constructor(
    config: IntelligenceConfig,
    eventBus: SwarmEventBus,
    logger: SwarmLogger,
    identity?: Partial<AgentIdentity>,
  ) {
    super();
    this.config = config;
    this.provider = resolveProviderConfig(config);
    this.eventBus = eventBus;
    this.agentId = identity?.id ?? `narrator-${uuidv4().slice(0, 8)}`;
    this.correlationId = uuidv4();
    this.logger = logger.child({
      agentId: this.agentId,
      category: 'narrative',
    });

    this.logger.info('NarrativeAgent initialized', {
      provider: config.llmProvider,
      model: this.provider.model,
    });
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Generate a complete token narrative — name, symbol, description,
   * image prompt, social hooks, and reasoning — via a single LLM call.
   */
  async generateNarrative(options: NarrativeOptions = {}): Promise<TokenNarrative> {
    this.emit('narrative:generating', options);
    this.eventBus.emit(
      'narrative:generating',
      'intelligence',
      this.agentId,
      { options },
      this.correlationId,
    );
    this.logger.info('Generating full narrative', { options });

    const systemPrompt = this.buildNarrativeSystemPrompt(options);
    const userPrompt = this.buildNarrativeUserPrompt(options);

    const raw = await this.callLLM(systemPrompt, userPrompt, CREATIVITY_TEMPERATURE);
    const parsed = this.parseJsonResponse<{
      name: string;
      symbol: string;
      description: string;
      category: string;
      keywords: string[];
      imagePrompt: string;
      socialHooks: string[];
      reasoning: string;
      confidence: number;
      trendConnections: string[];
      targetAudience: string;
    }>(raw, [
      'name', 'symbol', 'description', 'category', 'keywords',
      'imagePrompt', 'socialHooks', 'reasoning', 'confidence',
      'trendConnections', 'targetAudience',
    ]);

    // Validate and enforce constraints
    const narrative: TokenNarrative = {
      name: parsed.name.slice(0, 20),
      symbol: parsed.symbol.toUpperCase().slice(0, 6),
      description: parsed.description.slice(0, MAX_DESCRIPTION_LENGTH),
      category: parsed.category,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
      imagePrompt: parsed.imagePrompt,
      socialHooks: Array.isArray(parsed.socialHooks) ? parsed.socialHooks : [],
      reasoning: parsed.reasoning,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      trendConnections: Array.isArray(parsed.trendConnections) ? parsed.trendConnections : [],
      targetAudience: parsed.targetAudience,
      generatedAt: Date.now(),
    };

    // Check against blacklist
    if (options.blacklist?.length) {
      const lower = options.blacklist.map((b) => b.toLowerCase());
      if (
        lower.includes(narrative.name.toLowerCase()) ||
        lower.includes(narrative.symbol.toLowerCase())
      ) {
        this.logger.warn('Generated name/symbol is blacklisted, regenerating', {
          name: narrative.name,
          symbol: narrative.symbol,
        });
        return this.generateNarrative({
          ...options,
          blacklist: [...options.blacklist, narrative.name, narrative.symbol],
        });
      }
    }

    this.emit('narrative:generated', narrative);
    this.eventBus.emit(
      'narrative:generated',
      'intelligence',
      this.agentId,
      { narrative },
      this.correlationId,
    );
    this.logger.info('Narrative generated', {
      name: narrative.name,
      symbol: narrative.symbol,
      confidence: narrative.confidence,
    });

    return narrative;
  }

  /**
   * Generate just a token name and symbol.
   */
  async generateName(theme?: string): Promise<{ name: string; symbol: string; reasoning: string }> {
    this.logger.info('Generating name', { theme });

    const userPrompt = theme
      ? `Generate a token name and symbol around the theme: "${theme}". Make it creative and memorable.`
      : 'Generate a creative, unique, and memorable crypto token name and symbol. Surprise me with something fresh.';

    const raw = await this.callLLM(NAME_GENERATION_PROMPT, userPrompt, CREATIVITY_TEMPERATURE);
    const parsed = this.parseJsonResponse<{ name: string; symbol: string; reasoning: string }>(
      raw,
      ['name', 'symbol', 'reasoning'],
    );

    return {
      name: parsed.name.slice(0, 20),
      symbol: parsed.symbol.toUpperCase().slice(0, 6),
      reasoning: parsed.reasoning,
    };
  }

  /**
   * Generate a token description given a name and symbol.
   */
  async generateDescription(name: string, symbol: string): Promise<string> {
    this.logger.info('Generating description', { name, symbol });

    const userPrompt = `Generate a compelling Pump.fun token description for:
Name: ${name}
Symbol: ${symbol}

Make it punchy, fun, and under 300 characters. Hook the reader immediately.`;

    const raw = await this.callLLM(DESCRIPTION_GENERATION_PROMPT, userPrompt, CREATIVITY_TEMPERATURE);
    const parsed = this.parseJsonResponse<{ description: string }>(raw, ['description']);

    return parsed.description.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  /**
   * Generate a detailed image prompt for AI art generation.
   */
  async generateImagePrompt(narrative: TokenNarrative): Promise<string> {
    this.logger.info('Generating image prompt', { name: narrative.name });

    const userPrompt = `Create a detailed image generation prompt for this token:
Name: ${narrative.name}
Symbol: ${narrative.symbol}
Category: ${narrative.category}
Description: ${narrative.description}
Keywords: ${narrative.keywords.join(', ')}

The image should be iconic, recognizable at small sizes, and perfect for a token avatar/PFP.`;

    const raw = await this.callLLM(IMAGE_PROMPT_GENERATION, userPrompt, CREATIVITY_TEMPERATURE);
    const parsed = this.parseJsonResponse<{ imagePrompt: string }>(raw, ['imagePrompt']);

    return parsed.imagePrompt;
  }

  /**
   * Generate social media hooks for the token launch.
   */
  async generateSocialHooks(narrative: TokenNarrative, count?: number): Promise<string[]> {
    const hookCount = count ?? DEFAULT_SOCIAL_HOOK_COUNT;
    this.logger.info('Generating social hooks', { name: narrative.name, count: hookCount });

    const userPrompt = `Generate ${hookCount} viral social media hooks for this token launch:
Name: ${narrative.name} ($${narrative.symbol})
Description: ${narrative.description}
Category: ${narrative.category}
Target audience: ${narrative.targetAudience}

Mix of styles: hype announcements, community calls, humor, FOMO triggers.`;

    const raw = await this.callLLM(SOCIAL_HOOKS_PROMPT, userPrompt, CREATIVITY_TEMPERATURE);
    const parsed = this.parseJsonResponse<{ hooks: string[] }>(raw, ['hooks']);

    return Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, hookCount) : [];
  }

  /**
   * Evaluate a narrative's quality and viral potential.
   */
  async evaluateNarrative(narrative: TokenNarrative): Promise<NarrativeEvaluation> {
    this.logger.info('Evaluating narrative', { name: narrative.name });

    const userPrompt = `Evaluate this token launch narrative:

Name: ${narrative.name}
Symbol: ${narrative.symbol}
Description: ${narrative.description}
Category: ${narrative.category}
Keywords: ${narrative.keywords.join(', ')}
Target Audience: ${narrative.targetAudience}
Social Hooks:
${narrative.socialHooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}
Reasoning: ${narrative.reasoning}

Be critical. Score 0-100 overall. List specific strengths, weaknesses, and improvements.`;

    const raw = await this.callLLM(NARRATIVE_EVALUATION_PROMPT, userPrompt, EVALUATION_TEMPERATURE);
    const parsed = this.parseJsonResponse<NarrativeEvaluation>(raw, [
      'score', 'strengths', 'weaknesses', 'improvements',
    ]);

    const evaluation: NarrativeEvaluation = {
      score: Math.max(0, Math.min(100, Number(parsed.score))),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    };

    this.emit('narrative:evaluated', evaluation);
    this.eventBus.emit(
      'narrative:evaluated',
      'intelligence',
      this.agentId,
      { evaluation, name: narrative.name },
      this.correlationId,
    );
    this.logger.info('Narrative evaluated', {
      name: narrative.name,
      score: evaluation.score,
    });

    return evaluation;
  }

  /**
   * Generate Pump.fun-compatible metadata from a narrative.
   */
  async generateMetadata(narrative: TokenNarrative): Promise<PumpFunMetadata> {
    this.logger.info('Generating Pump.fun metadata', { name: narrative.name });

    const metadata: PumpFunMetadata = {
      name: narrative.name,
      symbol: narrative.symbol,
      description: narrative.description.slice(0, MAX_DESCRIPTION_LENGTH),
      image: narrative.imageUrl ?? '',
      showName: true,
      createdOn: 'https://pump.fun',
    };

    return metadata;
  }

  /**
   * Upload metadata JSON to IPFS via Pump.fun's endpoint or fallback providers.
   * Returns the IPFS/Arweave URI.
   */
  async uploadMetadata(metadata: PumpFunMetadata): Promise<string> {
    this.logger.info('Uploading metadata to IPFS', { name: metadata.name });

    // Try Pump.fun's own IPFS endpoint first
    const pumpUri = await this.uploadToPumpFunIpfs(metadata);
    if (pumpUri) {
      this.emitMetadataUploaded(pumpUri);
      return pumpUri;
    }

    // Fallback: nft.storage
    const nftStorageUri = await this.uploadToNftStorage(metadata);
    if (nftStorageUri) {
      this.emitMetadataUploaded(nftStorageUri);
      return nftStorageUri;
    }

    // Fallback: web3.storage
    const web3StorageUri = await this.uploadToWeb3Storage(metadata);
    if (web3StorageUri) {
      this.emitMetadataUploaded(web3StorageUri);
      return web3StorageUri;
    }

    throw new Error('All IPFS upload providers failed');
  }

  /**
   * Generate an image using DALL-E 3 or Stability AI, upload to IPFS,
   * and return the image URL.
   */
  async generateAndUploadImage(
    narrative: TokenNarrative,
    provider: 'dalle' | 'stability' = 'dalle',
  ): Promise<string> {
    this.logger.info('Generating image', { name: narrative.name, provider });

    const imagePrompt = narrative.imagePrompt || await this.generateImagePrompt(narrative);

    let imageBuffer: Buffer;

    if (provider === 'dalle') {
      imageBuffer = await this.generateImageDallE(imagePrompt);
    } else {
      imageBuffer = await this.generateImageStability(imagePrompt);
    }

    // Upload the image to IPFS
    const imageUrl = await this.uploadImageToIpfs(imageBuffer, `${narrative.symbol}.png`);
    this.logger.info('Image uploaded', { name: narrative.name, imageUrl });

    return imageUrl;
  }

  // ─── LLM Communication ─────────────────────────────────────

  /**
   * Call the configured LLM provider with retry logic.
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (this.config.llmProvider === 'anthropic') {
          return await this.callAnthropic(systemPrompt, userPrompt, temperature);
        }
        return await this.callOpenAICompatible(systemPrompt, userPrompt, temperature);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`LLM call failed (attempt ${attempt + 1}/${MAX_RETRIES})`, {
          error: lastError.message,
          provider: this.config.llmProvider,
        });

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    const finalError = lastError ?? new Error('LLM call failed after retries');
    this.emit('narrative:error', finalError);
    throw finalError;
  }

  /**
   * Call OpenAI-compatible API (OpenAI, OpenRouter).
   */
  private async callOpenAICompatible(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
  ): Promise<string> {
    const body: LLMCompletionRequest = {
      model: this.provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    };

    const response = await fetch(`${this.provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.provider.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `${this.config.llmProvider} API error (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`${this.config.llmProvider} returned empty response`);
    }

    return content;
  }

  /**
   * Call the Anthropic Messages API (non-OpenAI format).
   */
  private async callAnthropic(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
  ): Promise<string> {
    const body = {
      model: this.provider.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature,
      max_tokens: 2048,
    };

    const response = await fetch(`${this.provider.baseUrl}/messages`, {
      method: 'POST',
      headers: this.provider.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textBlock = data.content?.find((c) => c.type === 'text');

    if (!textBlock?.text) {
      throw new Error('Anthropic returned empty response');
    }

    return textBlock.text;
  }

  // ─── JSON Parsing ──────────────────────────────────────────

  /**
   * Parse and validate JSON from LLM output.
   * Handles common LLM quirks: markdown code fences, trailing commas, etc.
   */
  private parseJsonResponse<T extends Record<string, unknown>>(
    raw: string,
    requiredFields: string[],
  ): T {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Remove trailing commas before closing braces/brackets (common LLM error)
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    // Attempt to extract JSON from mixed text output
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      this.logger.error('Failed to parse LLM JSON output', undefined, {
        raw: raw.slice(0, 500),
        cleaned: cleaned.slice(0, 500),
      });
      throw new Error(
        `Failed to parse LLM JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('LLM response was not a JSON object');
    }

    // Validate required fields
    const obj = parsed as Record<string, unknown>;
    const missing = requiredFields.filter((f) => !(f in obj));
    if (missing.length > 0) {
      this.logger.warn('LLM response missing fields', { missing, available: Object.keys(obj) });
      // Don't throw — some fields may be optional in practice. Log and continue.
    }

    return obj as T;
  }

  // ─── IPFS Upload Providers ─────────────────────────────────

  /**
   * Upload metadata to Pump.fun's IPFS endpoint.
   */
  private async uploadToPumpFunIpfs(metadata: PumpFunMetadata): Promise<string | null> {
    try {
      const formData = new FormData();
      const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      formData.append('file', jsonBlob, 'metadata.json');
      formData.append('name', metadata.name);
      formData.append('symbol', metadata.symbol);
      formData.append('description', metadata.description);
      formData.append('showName', String(metadata.showName));

      const response = await fetch('https://pump.fun/api/ipfs', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        this.logger.warn('Pump.fun IPFS upload failed', { status: response.status });
        return null;
      }

      const data = (await response.json()) as { metadataUri?: string; metadata_uri?: string; uri?: string };
      const uri = data.metadataUri ?? data.metadata_uri ?? data.uri;

      if (!uri) {
        this.logger.warn('Pump.fun IPFS response missing URI', { data });
        return null;
      }

      this.logger.info('Metadata uploaded to Pump.fun IPFS', { uri });
      return uri;
    } catch (err) {
      this.logger.warn('Pump.fun IPFS upload error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Upload metadata to nft.storage.
   */
  private async uploadToNftStorage(metadata: PumpFunMetadata): Promise<string | null> {
    const nftStorageKey = process.env['NFT_STORAGE_API_KEY'];
    if (!nftStorageKey) {
      this.logger.debug('NFT_STORAGE_API_KEY not set, skipping nft.storage');
      return null;
    }

    try {
      const response = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nftStorageKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        this.logger.warn('nft.storage upload failed', { status: response.status });
        return null;
      }

      const data = (await response.json()) as { value?: { cid?: string } };
      const cid = data.value?.cid;

      if (!cid) {
        this.logger.warn('nft.storage response missing CID');
        return null;
      }

      const uri = `ipfs://${cid}`;
      this.logger.info('Metadata uploaded to nft.storage', { uri });
      return uri;
    } catch (err) {
      this.logger.warn('nft.storage upload error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Upload metadata to web3.storage.
   */
  private async uploadToWeb3Storage(metadata: PumpFunMetadata): Promise<string | null> {
    const web3StorageKey = process.env['WEB3_STORAGE_API_KEY'];
    if (!web3StorageKey) {
      this.logger.debug('WEB3_STORAGE_API_KEY not set, skipping web3.storage');
      return null;
    }

    try {
      const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });

      const response = await fetch('https://api.web3.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${web3StorageKey}`,
          'X-Name': `${metadata.symbol}-metadata.json`,
        },
        body: blob,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        this.logger.warn('web3.storage upload failed', { status: response.status });
        return null;
      }

      const data = (await response.json()) as { cid?: string };
      const cid = data.cid;

      if (!cid) {
        this.logger.warn('web3.storage response missing CID');
        return null;
      }

      const uri = `ipfs://${cid}`;
      this.logger.info('Metadata uploaded to web3.storage', { uri });
      return uri;
    } catch (err) {
      this.logger.warn('web3.storage upload error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // ─── Image Generation ──────────────────────────────────────

  /**
   * Generate an image using OpenAI DALL-E 3 API.
   */
  private async generateImageDallE(prompt: string): Promise<Buffer> {
    const apiKey = process.env['OPENAI_API_KEY'] ?? this.config.llmApiKey;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
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
      signal: AbortSignal.timeout(120_000),
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
   * Generate an image using Stability AI API.
   */
  private async generateImageStability(prompt: string): Promise<Buffer> {
    const apiKey = process.env['STABILITY_API_KEY'];
    if (!apiKey) {
      throw new Error('STABILITY_API_KEY environment variable not set');
    }

    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
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
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Stability AI error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      artifacts?: Array<{ base64?: string }>;
    };
    const b64 = data.artifacts?.[0]?.base64;

    if (!b64) {
      throw new Error('Stability AI returned no image data');
    }

    return Buffer.from(b64, 'base64');
  }

  /**
   * Upload image buffer to IPFS. Tries Pump.fun first, then nft.storage.
   */
  private async uploadImageToIpfs(imageBuffer: Buffer, filename: string): Promise<string> {
    // Try Pump.fun's endpoint
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
      formData.append('file', blob, filename);

      const response = await fetch('https://pump.fun/api/ipfs', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (response.ok) {
        const data = (await response.json()) as { metadataUri?: string; uri?: string; url?: string };
        const uri = data.metadataUri ?? data.uri ?? data.url;
        if (uri) return uri;
      }
    } catch {
      this.logger.warn('Pump.fun image upload failed, trying fallback');
    }

    // Fallback: nft.storage
    const nftStorageKey = process.env['NFT_STORAGE_API_KEY'];
    if (nftStorageKey) {
      try {
        const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });

        const response = await fetch('https://api.nft.storage/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${nftStorageKey}` },
          body: blob,
          signal: AbortSignal.timeout(30_000),
        });

        if (response.ok) {
          const data = (await response.json()) as { value?: { cid?: string } };
          const cid = data.value?.cid;
          if (cid) return `https://nftstorage.link/ipfs/${cid}`;
        }
      } catch {
        this.logger.warn('nft.storage image upload failed');
      }
    }

    throw new Error('All image upload providers failed');
  }

  // ─── Prompt Building ───────────────────────────────────────

  private buildNarrativeSystemPrompt(options: NarrativeOptions): string {
    let prompt = FULL_NARRATIVE_PROMPT;

    if (options.tone) {
      const toneGuides: Record<NonNullable<NarrativeOptions['tone']>, string> = {
        serious: '\n\nTone: Professional and credible. Think legitimate DeFi project, not meme.',
        meme: '\n\nTone: Full degen meme energy. Maximum humor and absurdity. Think DOGE, PEPE, WIF.',
        satirical: '\n\nTone: Satirical and clever. Parody existing crypto trends with wit.',
        educational: '\n\nTone: Educational but fun. Like a crypto professor who uses memes.',
      };
      prompt += toneGuides[options.tone];
    }

    if (options.viralityTarget !== undefined) {
      prompt += `\n\nVirality target: ${options.viralityTarget}/10. ${
        options.viralityTarget >= 8
          ? 'Go MAXIMUM viral. Controversy is fine. Push boundaries.'
          : options.viralityTarget >= 5
            ? 'Balance virality with substance. Trending but not cringe.'
            : 'Focus on quality over virality. Substance matters more.'
      }`;
    }

    return prompt;
  }

  private buildNarrativeUserPrompt(options: NarrativeOptions): string {
    const parts: string[] = [];

    if (options.theme && options.theme !== 'random') {
      parts.push(`Theme/Category: ${options.theme}`);
    } else {
      parts.push('Theme: Surprise me — pick the most promising angle right now.');
    }

    if (options.trendingTopics?.length) {
      parts.push(`Current trending topics to potentially incorporate: ${options.trendingTopics.join(', ')}`);
    }

    if (options.blacklist?.length) {
      parts.push(`AVOID these names/symbols (already taken): ${options.blacklist.join(', ')}`);
    }

    if (options.customPrompt) {
      parts.push(`Additional context: ${options.customPrompt}`);
    }

    parts.push('Generate a complete token narrative. Be creative, original, and think about what would actually go viral on Crypto Twitter right now.');

    return parts.join('\n\n');
  }

  // ─── Helpers ────────────────────────────────────────────────

  private emitMetadataUploaded(uri: string): void {
    this.emit('narrative:metadata-uploaded', uri);
    this.eventBus.emit(
      'narrative:metadata-uploaded',
      'intelligence',
      this.agentId,
      { uri },
      this.correlationId,
    );
    this.logger.info('Metadata uploaded', { uri });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
