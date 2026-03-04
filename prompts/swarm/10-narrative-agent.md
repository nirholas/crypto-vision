# Prompt 10 — Narrative Agent (AI-Powered Token Idea Generation)

## Agent Identity & Rules

```
You are the NARRATIVE-AGENT builder. Create the AI-powered narrative generation agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real API calls to real LLM providers  
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add narrative agent with LLM-powered token idea generation"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/narrative-agent.ts` — an AI agent that generates compelling token names, tickers, descriptions, image prompts, metadata, and social media hooks using real LLM APIs (OpenRouter/OpenAI/Anthropic).

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/narrative-agent.ts`

## Dependencies

- Types from `../types.ts`: `TokenNarrative`, `AgentIdentity`, `IntelligenceConfig`
- Event bus from `../infra/event-bus.ts`
- Logger from `../infra/logger.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/narrative-agent.ts`

1. **`NarrativeAgent` class** extends EventEmitter:
   - `constructor(config: IntelligenceConfig, eventBus: SwarmEventBus)`
   - `generateNarrative(options?: NarrativeOptions): Promise<TokenNarrative>` — full token idea
   - `generateName(theme?: string): Promise<{ name: string; symbol: string; reasoning: string }>`
   - `generateDescription(name: string, symbol: string): Promise<string>`
   - `generateImagePrompt(narrative: TokenNarrative): Promise<string>`
   - `generateSocialHooks(narrative: TokenNarrative, count?: number): Promise<string[]>`
   - `evaluateNarrative(narrative: TokenNarrative): Promise<{ score: number; strengths: string[]; weaknesses: string[]; improvements: string[] }>`
   - `generateMetadata(narrative: TokenNarrative): Promise<PumpFunMetadata>`
   - `uploadMetadata(metadata: PumpFunMetadata): Promise<string>` — uploads to IPFS/Arweave, returns URI

2. **NarrativeOptions**:
   ```typescript
   interface NarrativeOptions {
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
   ```

3. **LLM Integration** — Real API calls:
   - Support OpenRouter (preferred — access to many models)
   - Support direct OpenAI API
   - Support direct Anthropic API
   - Use `fetch()` directly — no SDK dependencies needed
   - Structured JSON output parsing with validation
   - Temperature tuning: creativity=0.9, evaluation=0.3

4. **System prompts** — Carefully crafted prompts for each generation task:
   - Name generation: Produce memorable, unique names that haven't been used
   - Description: 300-char max, hook + value prop + call to action
   - Image prompt: Detailed art prompt for Midjourney/DALL-E style
   - Social hooks: Twitter-optimized hooks with emoji, hashtags, engagement bait

5. **PumpFunMetadata type**:
   ```typescript
   interface PumpFunMetadata {
     name: string;
     symbol: string;
     description: string;
     image: string; // URL to image
     showName: boolean;
     createdOn: string; // "https://pump.fun"
     twitter?: string;
     telegram?: string;
     website?: string;
   }
   ```

6. **IPFS upload** — Upload metadata JSON to:
   - Pump.fun's own IPFS endpoint (https://pump.fun/api/ipfs) if available
   - Fallback to nft.storage or web3.storage
   - Return the IPFS/Arweave URI

7. **Image generation** (optional, but implement the caller):
   - Call DALL-E 3 or Stability AI API with the generated image prompt
   - Upload resulting image to IPFS
   - Update metadata with image URL

8. **Event emissions**:
   - `narrative:generating` — started generation
   - `narrative:generated` — complete narrative ready
   - `narrative:evaluated` — evaluation results
   - `narrative:metadata-uploaded` — metadata on IPFS

### Success Criteria

- Generates creative, unique token ideas via real LLM calls
- Metadata format matches Pump.fun requirements exactly
- IPFS upload produces valid URIs
- Multiple LLM providers supported with seamless fallback
- JSON output parsing is robust (handles malformed LLM output)
- Compiles with `npx tsc --noEmit`
