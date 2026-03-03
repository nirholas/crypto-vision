/**
 * Exchange API Routes
 * 
 * Connect, sync, and manage exchange integrations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import {
  saveExchangeCredentials,
  deleteExchangeCredentials,
  syncExchange,
  syncAllExchanges,
  getAggregatedPortfolio,
  getUserExchanges,
  SUPPORTED_EXCHANGES,
  isExchangeEncryptionConfigured,
  type ExchangeId,
  type ExchangeCredentials,
} from '@/lib/exchange-sync';

export const runtime = 'nodejs';

// =============================================================================
// AUTH MIDDLEWARE
// =============================================================================

async function requireAuth() {
  const session = await getSessionFromCookie();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Helper to validate exchange ID
function isValidExchange(exchange: string): exchange is ExchangeId {
  return SUPPORTED_EXCHANGES.some(e => e.id === exchange);
}

// =============================================================================
// GET - List exchanges, get portfolio
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'status': {
        // Return exchange service status
        const encryptionConfigured = isExchangeEncryptionConfigured();
        return NextResponse.json({
          configured: encryptionConfigured,
          supportedExchanges: SUPPORTED_EXCHANGES.map(e => e.id),
          notes: !encryptionConfigured
            ? 'Set EXCHANGE_ENCRYPTION_KEY in environment for secure credential storage.'
            : 'Exchange sync ready - all data from real exchange APIs.',
        });
      }

      case 'list': {
        // Get connected exchanges
        const userExchanges = await getUserExchanges(session.user.id);
        
        const configs = SUPPORTED_EXCHANGES.map(config => {
          const userExchange = userExchanges.find(e => e.exchangeId === config.id);
          return {
            id: config.id,
            name: config.name,
            connected: userExchange?.syncStatus === 'active',
            hasPassphrase: config.hasPassphrase,
            supportsFutures: config.supportsFutures,
            lastSync: userExchange?.lastSyncAt ?? null,
            syncStatus: userExchange?.syncStatus ?? null,
          };
        });
        
        return NextResponse.json({ exchanges: configs });
      }

      case 'portfolio': {
        // Get aggregated portfolio
        const portfolio = await getAggregatedPortfolio(session.user.id);
        return NextResponse.json(portfolio);
      }

      case 'config': {
        // Get exchange configs for UI
        const configs = SUPPORTED_EXCHANGES.map(config => ({
          id: config.id,
          name: config.name,
          hasPassphrase: config.hasPassphrase,
          supportsFutures: config.supportsFutures,
        }));
        return NextResponse.json({ exchanges: configs });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Exchange GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST - Connect exchange or trigger sync
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { action, exchange } = body;

    if (!exchange || !isValidExchange(exchange)) {
      return NextResponse.json({ error: 'Invalid exchange' }, { status: 400 });
    }

    switch (action) {
      case 'connect': {
        const { apiKey, apiSecret, passphrase, subaccount } = body;

        if (!apiKey || !apiSecret) {
          return NextResponse.json(
            { error: 'API key and secret are required' },
            { status: 400 }
          );
        }

        // Validate required fields for specific exchanges
        const config = SUPPORTED_EXCHANGES.find(e => e.id === exchange);
        if (config?.hasPassphrase && !passphrase) {
          return NextResponse.json(
            { error: 'Passphrase is required for this exchange' },
            { status: 400 }
          );
        }

        const credentials: ExchangeCredentials = {
          apiKey,
          apiSecret,
          passphrase,
          subaccount,
        };

        try {
          // Save credentials (this validates the connection internally)
          const saved = await saveExchangeCredentials(
            session.user.id,
            exchange as ExchangeId,
            credentials
          );

          // Try initial sync
          const syncResult = await syncExchange(saved.id);
          
          return NextResponse.json({
            success: true,
            message: 'Exchange connected and synced',
            credentialId: saved.id,
            sync: syncResult,
          });
        } catch (saveError) {
          return NextResponse.json(
            { error: (saveError as Error).message || 'Failed to connect' },
            { status: 400 }
          );
        }
      }

      case 'sync': {
        // Get user's credential for this exchange
        const userExchanges = await getUserExchanges(session.user.id);
        const exchangeCredential = userExchanges.find(
          e => e.exchangeId === exchange && e.syncStatus !== 'disabled'
        );

        if (!exchangeCredential) {
          return NextResponse.json(
            { error: 'Exchange not connected' },
            { status: 404 }
          );
        }

        const syncResult = await syncExchange(exchangeCredential.id);
        
        if (!syncResult.success) {
          return NextResponse.json(
            { error: syncResult.error || 'Sync failed' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Sync completed',
          sync: syncResult,
        });
      }

      case 'sync-all': {
        // Sync all connected exchanges
        const results = await syncAllExchanges(session.user.id);
        
        const synced = results.filter(r => r.success).length;
        const failed = results.length - synced;

        return NextResponse.json({
          success: failed === 0,
          message: `Synced ${synced}/${results.length} exchanges`,
          results: results.map(r => ({
            exchange: r.exchangeId,
            success: r.success,
            error: r.error,
          })),
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Exchange POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Disconnect exchange
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange');

    if (!exchange || !isValidExchange(exchange)) {
      return NextResponse.json({ error: 'Invalid exchange' }, { status: 400 });
    }

    // Find the credential ID for this exchange
    const userExchanges = await getUserExchanges(session.user.id);
    const exchangeCredential = userExchanges.find(e => e.exchangeId === exchange);

    if (!exchangeCredential) {
      return NextResponse.json(
        { error: 'Exchange not connected' },
        { status: 404 }
      );
    }

    await deleteExchangeCredentials(exchangeCredential.id);

    return NextResponse.json({
      success: true,
      message: 'Exchange disconnected',
    });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Exchange DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
