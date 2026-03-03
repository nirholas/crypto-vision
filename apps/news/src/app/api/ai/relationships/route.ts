import { type NextRequest, NextResponse } from 'next/server';
import { promptGroq } from '@/lib/groq';

interface Relationship {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const systemPrompt = 'You are an expert at extracting relationships from text. Always respond with valid JSON only.';
    const userPrompt = `Extract all relationships from this text as JSON array. Each relationship should have: subject (who/what), predicate (action/relationship), object (to whom/what), confidence (0-1).

Text: ${text}

Return ONLY valid JSON array like: [{"subject":"Bitcoin","predicate":"surpassed","object":"$100K","confidence":0.95}]`;

    const response = await promptGroq(systemPrompt, userPrompt);
    
    // Parse JSON from response
    let relationships: Relationship[] = [];
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        relationships = JSON.parse(jsonMatch[0]);
      }
    } catch {
      relationships = [];
    }
    
    return NextResponse.json({
      text_length: text.length,
      relationships,
      count: relationships.length
    });
  } catch (error) {
    console.error('Relationship extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
