/**
 * OpenAPI Specification Endpoint
 * 
 * Serves the OpenAPI 3.1 specification in JSON format.
 * Can be used with Swagger UI or other API documentation tools.
 * 
 * @route GET /api/v2/openapi.json
 */

import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/openapi';

export const dynamic = 'force-static';
export const revalidate = 3600; // Regenerate every hour

export async function GET() {
  const spec = generateOpenAPISpec();
  
  return new NextResponse(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
