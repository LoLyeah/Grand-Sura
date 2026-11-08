import { NextRequest, NextResponse } from 'next/server';
import { getServerGeminiClient } from '@/lib/gemini-server';

export async function POST(req: NextRequest) {
  try {
    const { tileName, city, country, landmarkQuery } = await req.json();
    const ai = getServerGeminiClient();

    const queryPrompt = `Provide a concise, fascinating real-world luxury real estate and cultural briefing for "${tileName}" in ${city}, ${country} (Search context: ${landmarkQuery}).
Include:
1. **Architectural & Cultural Prestige**: Why this avenue or landmark is world-famous.
2. **Real-World Property & Market Pulse**: Notable current facts, prestige retail/property benchmarks, or recent tourism/economic highlights.
3. **Tycoon Trivia**: One surprising historical or financial fact.
Keep it well-structured in clean Markdown under 160 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: queryPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text =
      response.text ||
      `Unable to retrieve live briefing for ${tileName} (${city}).`;

    const rawChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: { uri: string; title: string }[] = [];

    for (const chunk of rawChunks) {
      if (chunk.web?.uri) {
        sources.push({
          uri: chunk.web.uri,
          title: chunk.web.title || chunk.web.uri,
        });
      }
    }

    return NextResponse.json({
      text,
      sources,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to fetch Google Search landmark intelligence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
