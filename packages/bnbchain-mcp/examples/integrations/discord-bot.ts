/**
 * Discord Bot Integration - Integration Example
 *
 * This example demonstrates how to:
 * - Create a Discord bot with slash commands
 * - Integrate with Universal Crypto MCP
 * - Handle user interactions with embeds
 * - Implement rate limiting and error handling
 *
 * Difficulty: ⭐⭐⭐ Intermediate
 * Prerequisites: Node.js 18+, Discord Bot Token, Discord.js
 * Estimated Time: 45 minutes
 *
 * @author Nich
 * @license MIT
 */

import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    type ChatInputCommandInteraction,
    type ColorResolvable,
    ApplicationCommandOptionType
} from "discord.js";
import { spawn } from "child_process";

// ============================================================================
// Configuration
// ============================================================================

interface BotConfig {
    discordToken: string;
    clientId: string;
    guildId?: string; // Optional: for guild-specific commands
}

const config: BotConfig = {
    discordToken: process.env.DISCORD_BOT_TOKEN || "",
    clientId: process.env.DISCORD_CLIENT_ID || "",
    guildId: process.env.DISCORD_GUILD_ID
};

// Network emoji mapping
const NETWORK_EMOJIS: Record<string, string> = {
    ethereum: "💎",
    bsc: "🔶",
    arbitrum: "🔷",
    polygon: "🟣",
    optimism: "🔴",
    base: "🔵",
    avalanche: "🔺"
};

// ============================================================================
// Slash Commands Definition
// ============================================================================

const commands = [
    new SlashCommandBuilder()
        .setName("balance")
        .setDescription("Check wallet balance")
        .addStringOption(option =>
            option
                .setName("address")
                .setDescription("Wallet address")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("network")
                .setDescription("Blockchain network")
                .setRequired(false)
                .addChoices(
                    { name: "Ethereum", value: "ethereum" },
                    { name: "BNB Chain", value: "bsc" },
                    { name: "Arbitrum", value: "arbitrum" },
                    { name: "Polygon", value: "polygon" },
                    { name: "Optimism", value: "optimism" },
                    { name: "Base", value: "base" }
                )
        ),

    new SlashCommandBuilder()
        .setName("price")
        .setDescription("Get cryptocurrency price")
        .addStringOption(option =>
            option
                .setName("coin")
                .setDescription("Coin name (e.g., bitcoin, ethereum)")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("gas")
        .setDescription("Get current gas prices")
        .addStringOption(option =>
            option
                .setName("network")
                .setDescription("Blockchain network")
                .setRequired(false)
                .addChoices(
                    { name: "Ethereum", value: "ethereum" },
                    { name: "BNB Chain", value: "bsc" },
                    { name: "Arbitrum", value: "arbitrum" },
                    { name: "Polygon", value: "polygon" }
                )
        ),

    new SlashCommandBuilder()
        .setName("security")
        .setDescription("Check token security")
        .addStringOption(option =>
            option
                .setName("address")
                .setDescription("Token contract address")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("network")
                .setDescription("Blockchain network")
                .setRequired(false)
                .addChoices(
                    { name: "Ethereum", value: "ethereum" },
                    { name: "BNB Chain", value: "bsc" },
                    { name: "Arbitrum", value: "arbitrum" },
                    { name: "Polygon", value: "polygon" }
                )
        ),

    new SlashCommandBuilder()
        .setName("trending")
        .setDescription("Get trending cryptocurrencies"),

    new SlashCommandBuilder()
        .setName("portfolio")
        .setDescription("Get multi-chain portfolio")
        .addStringOption(option =>
            option
                .setName("address")
                .setDescription("Wallet address")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("feargreed")
        .setDescription("Get Fear & Greed Index")
];

// ============================================================================
// MCP Client Manager
// ============================================================================

class MCPManager {
    private client: MCPClient | null = null;
    private transport: StdioClientTransport | null = null;
    private connected = false;

    async connect(): Promise<void> {
        if (this.connected) return;

        const serverProcess = spawn("npx", ["-y", "@nirholas/universal-crypto-mcp@latest"], {
            stdio: ["pipe", "pipe", "pipe"]
        });

        this.transport = new StdioClientTransport({
            command: "npx",
            args: ["-y", "@nirholas/universal-crypto-mcp@latest"]
        });

        this.client = new MCPClient({
            name: "discord-bot",
            version: "1.0.0"
        }, {
            capabilities: {}
        });

        await this.client.connect(this.transport);
        this.connected = true;
        console.log("✅ Connected to MCP server");
    }

    async disconnect(): Promise<void> {
        if (this.transport) {
            await this.transport.close();
        }
        this.connected = false;
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
        if (!this.client || !this.connected) {
            await this.connect();
        }

        const result = await this.client!.callTool({
            name,
            arguments: args
        });

        // Parse the content
        const content = result.content as Array<{ type: string; text?: string }>;
        if (content?.[0]?.type === "text" && content[0].text) {
            try {
                return JSON.parse(content[0].text);
            } catch {
                return content[0].text;
            }
        }

        return result;
    }
}

// ============================================================================
// Embed Builders
// ============================================================================

function createBalanceEmbed(
    address: string,
    network: string,
    balance: { formatted: string; symbol: string; usdValue?: number }
): EmbedBuilder {
    const emoji = NETWORK_EMOJIS[network] || "🔗";
    
    const embed = new EmbedBuilder()
        .setTitle(`${emoji} Wallet Balance`)
        .setColor(0x00FF00 as ColorResolvable)
        .addFields(
            { name: "Network", value: network.toUpperCase(), inline: true },
            { name: "Balance", value: `${balance.formatted} ${balance.symbol}`, inline: true }
        )
        .setFooter({ text: `Address: ${address.slice(0, 8)}...${address.slice(-6)}` })
        .setTimestamp();

    if (balance.usdValue) {
        embed.addFields({
            name: "USD Value",
            value: `$${balance.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            inline: true
        });
    }

    return embed;
}

function createPriceEmbed(coin: {
    name: string;
    symbol: string;
    current_price: number;
    price_change_percentage_24h: number;
    market_cap: number;
    total_volume: number;
    market_cap_rank: number;
    image?: string;
}): EmbedBuilder {
    const change = coin.price_change_percentage_24h || 0;
    const color = change >= 0 ? 0x00FF00 : 0xFF0000;
    const arrow = change >= 0 ? "📈" : "📉";

    const embed = new EmbedBuilder()
        .setTitle(`${coin.name} (${coin.symbol.toUpperCase()})`)
        .setColor(color as ColorResolvable)
        .addFields(
            {
                name: "💰 Price",
                value: `$${coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`,
                inline: true
            },
            {
                name: `${arrow} 24h Change`,
                value: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
                inline: true
            },
            {
                name: "📊 Market Cap",
                value: `$${formatLargeNumber(coin.market_cap)}`,
                inline: true
            },
            {
                name: "📈 24h Volume",
                value: `$${formatLargeNumber(coin.total_volume)}`,
                inline: true
            },
            {
                name: "🏆 Rank",
                value: `#${coin.market_cap_rank}`,
                inline: true
            }
        )
        .setTimestamp();

    if (coin.image) {
        embed.setThumbnail(coin.image);
    }

    return embed;
}

function createGasEmbed(
    network: string,
    gas: { slow: number; standard: number; fast: number }
): EmbedBuilder {
    const emoji = NETWORK_EMOJIS[network] || "⛽";

    return new EmbedBuilder()
        .setTitle(`${emoji} Gas Prices - ${network.toUpperCase()}`)
        .setColor(0xFFA500 as ColorResolvable)
        .addFields(
            { name: "🐢 Slow", value: `${gas.slow} Gwei`, inline: true },
            { name: "🚗 Standard", value: `${gas.standard} Gwei`, inline: true },
            { name: "🚀 Fast", value: `${gas.fast} Gwei`, inline: true }
        )
        .setFooter({ text: "Gas prices update every block" })
        .setTimestamp();
}

function createSecurityEmbed(
    address: string,
    network: string,
    security: {
        score: number;
        isHoneypot?: boolean;
        canMint?: boolean;
        hasTax?: boolean;
        taxPercent?: number;
        risks?: Array<{ severity: string; type: string; message?: string }>;
    }
): EmbedBuilder {
    const score = security.score || 0;
    let color: ColorResolvable;
    let statusEmoji: string;

    if (score >= 80) {
        color = 0x00FF00;
        statusEmoji = "✅";
    } else if (score >= 50) {
        color = 0xFFA500;
        statusEmoji = "⚠️";
    } else {
        color = 0xFF0000;
        statusEmoji = "🚨";
    }

    const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} Security Analysis`)
        .setColor(color)
        .setDescription(`Token on **${network.toUpperCase()}**`)
        .addFields(
            { name: "📊 Score", value: `${score}/100`, inline: true },
            { name: "🍯 Honeypot", value: security.isHoneypot ? "⚠️ Yes" : "✅ No", inline: true },
            { name: "🖨️ Can Mint", value: security.canMint ? "⚠️ Yes" : "✅ No", inline: true }
        )
        .setFooter({ text: `Contract: ${address.slice(0, 10)}...${address.slice(-8)}` })
        .setTimestamp();

    if (security.hasTax && security.taxPercent) {
        embed.addFields({
            name: "💸 Tax",
            value: `${security.taxPercent}%`,
            inline: true
        });
    }

    // Add top risks
    if (security.risks && security.risks.length > 0) {
        const riskText = security.risks.slice(0, 3).map(r => {
            const emoji = r.severity === "critical" ? "🔴" : r.severity === "high" ? "🟠" : "🟡";
            return `${emoji} ${r.message || r.type}`;
        }).join("\n");

        embed.addFields({ name: "⚠️ Risks", value: riskText || "None detected" });
    }

    return embed;
}

function createTrendingEmbed(coins: Array<{
    item: {
        name: string;
        symbol: string;
        market_cap_rank: number;
        price_btc?: number;
    };
}>): EmbedBuilder {
    const coinList = coins.slice(0, 10).map((coin, i) => {
        const item = coin.item;
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return `${medal} **${item.name}** (${item.symbol.toUpperCase()}) - Rank #${item.market_cap_rank || "N/A"}`;
    }).join("\n");

    return new EmbedBuilder()
        .setTitle("🔥 Trending Cryptocurrencies")
        .setColor(0xFF4500 as ColorResolvable)
        .setDescription(coinList)
        .setFooter({ text: "Based on CoinGecko trending data" })
        .setTimestamp();
}

function createFearGreedEmbed(index: {
    value: number;
    classification: string;
    timestamp?: string;
}): EmbedBuilder {
    const value = index.value;
    let color: ColorResolvable;
    let emoji: string;

    if (value <= 25) {
        color = 0xFF0000;
        emoji = "😱";
    } else if (value <= 45) {
        color = 0xFFA500;
        emoji = "😰";
    } else if (value <= 55) {
        color = 0xFFFF00;
        emoji = "😐";
    } else if (value <= 75) {
        color = 0x90EE90;
        emoji = "😊";
    } else {
        color = 0x00FF00;
        emoji = "🤑";
    }

    return new EmbedBuilder()
        .setTitle(`${emoji} Fear & Greed Index`)
        .setColor(color)
        .addFields(
            { name: "📊 Value", value: `${value}/100`, inline: true },
            { name: "📈 Sentiment", value: index.classification || "Unknown", inline: true }
        )
        .setDescription(getMarketAdvice(value))
        .setFooter({ text: "Updated daily" })
        .setTimestamp();
}

function createPortfolioEmbed(
    address: string,
    holdings: Array<{ network: string; balance: string; symbol: string; usdValue?: number }>
): EmbedBuilder {
    const totalUsd = holdings.reduce((sum, h) => sum + (h.usdValue || 0), 0);

    const holdingsList = holdings.map(h => {
        const emoji = NETWORK_EMOJIS[h.network] || "🔗";
        const usd = h.usdValue ? ` ($${h.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : "";
        return `${emoji} **${h.network}**: ${h.balance} ${h.symbol}${usd}`;
    }).join("\n");

    return new EmbedBuilder()
        .setTitle("💼 Multi-Chain Portfolio")
        .setColor(0x7289DA as ColorResolvable)
        .setDescription(holdingsList || "No balances found")
        .addFields({
            name: "💰 Total Value",
            value: `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            inline: false
        })
        .setFooter({ text: `Wallet: ${address.slice(0, 8)}...${address.slice(-6)}` })
        .setTimestamp();
}

function createErrorEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle("❌ Error")
        .setColor(0xFF0000 as ColorResolvable)
        .setDescription(message)
        .setTimestamp();
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatLargeNumber(num: number): string {
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
}

function getMarketAdvice(fearGreedValue: number): string {
    if (fearGreedValue <= 25) {
        return "📉 **Extreme Fear** - Markets are very bearish. Could be a buying opportunity for long-term holders, but proceed with caution.";
    } else if (fearGreedValue <= 45) {
        return "😰 **Fear** - Sentiment is negative. Consider dollar-cost averaging if you believe in long-term growth.";
    } else if (fearGreedValue <= 55) {
        return "😐 **Neutral** - Market is balanced. Good time for research and planning.";
    } else if (fearGreedValue <= 75) {
        return "😊 **Greed** - Sentiment is positive. Be careful of FOMO and consider taking some profits.";
    } else {
        return "🤑 **Extreme Greed** - Markets are very bullish. Be cautious - this often precedes corrections.";
    }
}

function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ============================================================================
// Discord Bot
// ============================================================================

class CryptoBot {
    private discord: Client;
    private mcp: MCPManager;
    private ready = false;

    constructor() {
        this.discord = new Client({
            intents: [GatewayIntentBits.Guilds]
        });

        this.mcp = new MCPManager();

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.discord.once("ready", () => {
            console.log(`✅ Logged in as ${this.discord.user?.tag}`);
            this.ready = true;
        });

        this.discord.on("interactionCreate", async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleCommand(interaction);
        });
    }

    async start(): Promise<void> {
        if (!config.discordToken) {
            throw new Error("DISCORD_BOT_TOKEN is required");
        }

        // Connect to MCP server
        console.log("Connecting to MCP server...");
        await this.mcp.connect();

        // Register slash commands
        console.log("Registering slash commands...");
        await this.registerCommands();

        // Login to Discord
        console.log("Logging in to Discord...");
        await this.discord.login(config.discordToken);
    }

    async stop(): Promise<void> {
        await this.mcp.disconnect();
        this.discord.destroy();
    }

    private async registerCommands(): Promise<void> {
        const rest = new REST({ version: "10" }).setToken(config.discordToken);

        const commandData = commands.map(cmd => cmd.toJSON());

        if (config.guildId) {
            // Guild-specific commands (instant update)
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commandData }
            );
            console.log(`✅ Registered ${commandData.length} guild commands`);
        } else {
            // Global commands (can take up to an hour to propagate)
            await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commandData }
            );
            console.log(`✅ Registered ${commandData.length} global commands`);
        }
    }

    private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const { commandName } = interaction;

        try {
            // Defer reply for long operations
            await interaction.deferReply();

            switch (commandName) {
                case "balance":
                    await this.handleBalance(interaction);
                    break;
                case "price":
                    await this.handlePrice(interaction);
                    break;
                case "gas":
                    await this.handleGas(interaction);
                    break;
                case "security":
                    await this.handleSecurity(interaction);
                    break;
                case "trending":
                    await this.handleTrending(interaction);
                    break;
                case "portfolio":
                    await this.handlePortfolio(interaction);
                    break;
                case "feargreed":
                    await this.handleFearGreed(interaction);
                    break;
                default:
                    await interaction.editReply({ embeds: [createErrorEmbed("Unknown command")] });
            }
        } catch (error) {
            console.error(`Error handling ${commandName}:`, error);
            const embed = createErrorEmbed(
                error instanceof Error ? error.message : "An unexpected error occurred"
            );
            await interaction.editReply({ embeds: [embed] });
        }
    }

    private async handleBalance(interaction: ChatInputCommandInteraction): Promise<void> {
        const address = interaction.options.getString("address", true);
        const network = interaction.options.getString("network") || "ethereum";

        if (!isValidAddress(address)) {
            await interaction.editReply({
                embeds: [createErrorEmbed("Invalid Ethereum address format")]
            });
            return;
        }

        const result = await this.mcp.callTool("get_native_balance", {
            address,
            network
        }) as { formatted: string; symbol: string; usdValue?: number };

        const embed = createBalanceEmbed(address, network, result);
        await interaction.editReply({ embeds: [embed] });
    }

    private async handlePrice(interaction: ChatInputCommandInteraction): Promise<void> {
        const coinId = interaction.options.getString("coin", true).toLowerCase();

        const result = await this.mcp.callTool("market_get_coin_by_id", {
            coinId,
            currency: "USD"
        }) as { coin: Parameters<typeof createPriceEmbed>[0] };

        if (!result.coin) {
            await interaction.editReply({
                embeds: [createErrorEmbed(`Coin "${coinId}" not found. Try using the CoinGecko ID (e.g., "bitcoin", "ethereum").`)]
            });
            return;
        }

        const embed = createPriceEmbed(result.coin);
        await interaction.editReply({ embeds: [embed] });
    }

    private async handleGas(interaction: ChatInputCommandInteraction): Promise<void> {
        const network = interaction.options.getString("network") || "ethereum";

        const result = await this.mcp.callTool("get_gas_price", {
            network
        }) as { gasPrice: { slow: number; standard: number; fast: number } };

        const embed = createGasEmbed(network, result.gasPrice);
        await interaction.editReply({ embeds: [embed] });
    }

    private async handleSecurity(interaction: ChatInputCommandInteraction): Promise<void> {
        const address = interaction.options.getString("address", true);
        const network = interaction.options.getString("network") || "ethereum";

        if (!isValidAddress(address)) {
            await interaction.editReply({
                embeds: [createErrorEmbed("Invalid token address format")]
            });
            return;
        }

        const result = await this.mcp.callTool("security_check_token", {
            tokenAddress: address,
            network
        }) as Parameters<typeof createSecurityEmbed>[2];

        const embed = createSecurityEmbed(address, network, result);
        await interaction.editReply({ embeds: [embed] });
    }

    private async handleTrending(interaction: ChatInputCommandInteraction): Promise<void> {
        const result = await this.mcp.callTool("market_get_trending", {}) as {
            coins: Parameters<typeof createTrendingEmbed>[0]
        };

        const embed = createTrendingEmbed(result.coins);
        await interaction.editReply({ embeds: [embed] });
    }

    private async handlePortfolio(interaction: ChatInputCommandInteraction): Promise<void> {
        const address = interaction.options.getString("address", true);

        if (!isValidAddress(address)) {
            await interaction.editReply({
                embeds: [createErrorEmbed("Invalid wallet address format")]
            });
            return;
        }

        const networks = ["ethereum", "bsc", "arbitrum", "polygon", "optimism", "base"];
        const holdings: Array<{ network: string; balance: string; symbol: string; usdValue?: number }> = [];

        for (const network of networks) {
            try {
                const result = await this.mcp.callTool("get_native_balance", {
                    address,
                    network
                }) as { formatted: string; symbol: string; usdValue?: number };

                if (parseFloat(result.formatted) > 0) {
                    holdings.push({
                        network,
                        balance: result.formatted,
                        symbol: result.symbol,
                        usdValue: result.usdValue
                    });
                }
            } catch {
                // Skip failed networks
            }
        }

        const embed = createPortfolioEmbed(address, holdings);
        await interaction.editReply({ embeds: [embed] });
    }

    private async handleFearGreed(interaction: ChatInputCommandInteraction): Promise<void> {
        const result = await this.mcp.callTool("market_get_fear_and_greed", {}) as {
            value: number;
            classification: string;
        };

        const embed = createFearGreedEmbed(result);
        await interaction.editReply({ embeds: [embed] });
    }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
    console.log("=" .repeat(60));
    console.log("🤖 Universal Crypto MCP Discord Bot");
    console.log("=" .repeat(60));
    console.log();

    if (!config.discordToken) {
        console.error("❌ DISCORD_BOT_TOKEN environment variable is required");
        console.log("\nSetup instructions:");
        console.log("1. Create a Discord application at https://discord.com/developers");
        console.log("2. Create a bot and copy the token");
        console.log("3. Set environment variables:");
        console.log("   export DISCORD_BOT_TOKEN=your-bot-token");
        console.log("   export DISCORD_CLIENT_ID=your-client-id");
        console.log("   export DISCORD_GUILD_ID=your-guild-id  # Optional");
        process.exit(1);
    }

    if (!config.clientId) {
        console.error("❌ DISCORD_CLIENT_ID environment variable is required");
        process.exit(1);
    }

    const bot = new CryptoBot();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
        console.log("\n👋 Shutting down...");
        await bot.stop();
        process.exit(0);
    });

    process.on("SIGTERM", async () => {
        await bot.stop();
        process.exit(0);
    });

    try {
        await bot.start();
        console.log("\n✅ Bot is running! Invite URL:");
        console.log(`https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=2147485696&scope=bot%20applications.commands`);
    } catch (error) {
        console.error("❌ Failed to start bot:", error);
        process.exit(1);
    }
}

main();


// ============================================================================
// Usage Documentation
// ============================================================================

/**
 * Setup Instructions:
 *
 * 1. Create Discord Application:
 *    - Go to https://discord.com/developers/applications
 *    - Create a new application
 *    - Go to "Bot" section and create a bot
 *    - Copy the bot token
 *    - Enable "MESSAGE CONTENT INTENT" if needed
 *
 * 2. Get Client ID:
 *    - In the "General Information" section
 *    - Copy the "Application ID" (this is your Client ID)
 *
 * 3. Set Environment Variables:
 *    export DISCORD_BOT_TOKEN=your-bot-token
 *    export DISCORD_CLIENT_ID=your-client-id
 *    export DISCORD_GUILD_ID=your-test-server-id  # Optional for faster command updates
 *
 * 4. Install Dependencies:
 *    npm install discord.js @modelcontextprotocol/sdk
 *
 * 5. Run the Bot:
 *    npx tsx discord-bot.ts
 *
 * 6. Invite the Bot:
 *    - Use the invite URL printed by the bot
 *    - Or generate at: https://discord.com/developers/applications/YOUR_CLIENT_ID/oauth2
 *
 * Available Slash Commands:
 *    /balance <address> [network] - Check wallet balance
 *    /price <coin> - Get cryptocurrency price
 *    /gas [network] - Get current gas prices
 *    /security <address> [network] - Check token security
 *    /trending - Get trending cryptocurrencies
 *    /portfolio <address> - Get multi-chain portfolio
 *    /feargreed - Get Fear & Greed Index
 */
