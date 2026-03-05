import { NextRequest, NextResponse } from 'next/server';

const SWARM_API_URL = process.env.NEXT_PUBLIC_SWARM_API_URL ?? 'http://localhost:3847';

/**
 * POST /api/swarm/launch
 *
 * Proxies a swarm launch request to the pump-agent-swarm backend.
 * Accepts token config, strategy, wallet key, etc. and forwards to the orchestrator.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { token, strategy, network, traderCount, masterWalletKey } = body;

    if (!token?.name || !token?.symbol || !token?.metadataUri) {
      return NextResponse.json(
        { error: 'Token name, symbol, and metadataUri are required' },
        { status: 400 },
      );
    }

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy is required' },
        { status: 400 },
      );
    }

    if (!masterWalletKey) {
      return NextResponse.json(
        { error: 'Master wallet private key is required' },
        { status: 400 },
      );
    }

    // Forward to the swarm backend
    const response = await fetch(`${SWARM_API_URL}/api/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        strategy,
        network: network ?? 'devnet',
        traderCount: traderCount ?? 5,
        masterWalletKey,
        rpcUrl: body.rpcUrl,
        jitoTipLamports: body.jitoTipLamports ?? 10_000,
        devBuySol: body.devBuySol ?? 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error ?? errorText;
      } catch {
        // Use raw text
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // If the swarm backend is not reachable, provide a helpful error
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('ECONNREFUSED'))) {
      return NextResponse.json(
        {
          error: `Cannot reach swarm backend at ${SWARM_API_URL}. Ensure the pump-agent-swarm service is running.`,
        },
        { status: 503 },
      );
    }

    console.error('Error launching swarm:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Launch failed' },
      { status: 500 },
    );
  }
}
