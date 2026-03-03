/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import QRCode from 'qrcode';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface Arc26ToolInput {
  address: string;
  label?: string;
  amount?: number;
  asset?: number;
  note?: string;
  xnote?: string;
}

export class Arc26Manager {
  public arc26Tools = [
    {
      name: 'generate_algorand_uri',
      description: 'Generate an Algorand URI and QR code according to ARC-26 specification',
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Algorand address in standard format (58 characters)'
          },
          label: {
            type: 'string',
            description: 'Label for the address (e.g. name of receiver)',
            optional: true
          },
          amount: {
            type: 'number',
            description: 'Amount in microAlgos (must be non-negative)',
            optional: true
          },
          asset: {
            type: 'number',
            description: 'Asset ID for ASA transfers',
            optional: true
          },
          note: {
            type: 'string',
            description: 'URL-encoded note that can be modified by user',
            optional: true
          },
          xnote: {
            type: 'string',
            description: 'URL-encoded note that must not be modified by user',
            optional: true
          }
        },
        required: ['address']
      }
    }
  ];

  /**
   * Constructs an Algorand URI according to ARC-26 specification and generates a QR code
   * @param params The parameters for constructing the URI
   * @returns Object containing the URI and QR code as base64 data URL
   */
  async generateUriAndQr(params: Arc26ToolInput): Promise<{ uri: string; qrCode: string }> {
    // Validate address format (base32 string)
    if (!params.address || !/^[A-Z2-7]{58}$/.test(params.address)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid Algorand address format');
    }

    // Start building the URI with the scheme and address
    let uri = `algorand://${params.address}`;

    // Build query parameters
    const queryParams: string[] = [];

    // Add optional parameters if provided
    if (params.label) {
      queryParams.push(`label=${encodeURIComponent(params.label)}`);
    }

    if (typeof params.amount === 'number') {
      if (params.amount < 0) {
        throw new McpError(ErrorCode.InvalidParams, 'Amount must be non-negative');
      }
      // Convert to microAlgos and ensure no decimals
      const microAlgos = Math.floor(params.amount);
      queryParams.push(`amount=${microAlgos}`);
    }

    if (typeof params.asset === 'number') {
      if (params.asset < 0) {
        throw new McpError(ErrorCode.InvalidParams, 'Asset ID must be non-negative');
      }
      queryParams.push(`asset=${params.asset}`);
    }

    if (params.note) {
      queryParams.push(`note=${encodeURIComponent(params.note)}`);
    }

    if (params.xnote) {
      queryParams.push(`xnote=${encodeURIComponent(params.xnote)}`);
    }

    // Add query parameters to URI if any exist
    if (queryParams.length > 0) {
      uri += '?' + queryParams.join('&');
    }

    // Generate QR code as SVG
    const qrCode = await QRCode.toString(uri, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });

    return {
      uri,
      qrCode
    };
  }

  async handleTool(name: string, args: Record<string, unknown>) {
    // Cast args to Arc26ToolInput after validation
    const toolArgs: Arc26ToolInput = {
      address: args.address as string,
      label: args.label as string | undefined,
      amount: typeof args.amount === 'number' ? args.amount : undefined,
      asset: typeof args.asset === 'number' ? args.asset : undefined,
      note: args.note as string | undefined,
      xnote: args.xnote as string | undefined
    };
    if (name === 'generate_algorand_uri') {
      const { uri, qrCode } = await this.generateUriAndQr(toolArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ uri }, null, 2)
          },
          {
            type: "text",
            text: qrCode,
            mimeType: "image/svg+xml"
          }
        ]
      };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}

export const arc26Manager = new Arc26Manager();
