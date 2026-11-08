import { NextRequest, NextResponse } from 'next/server';
import {
  buildHostSystemInstruction,
  getServerGeminiClient,
} from '@/lib/gemini-server';
import { HostConfig } from '@/lib/monopoly-data';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventSummary,
      hostConfig,
      boardContext,
      directScript,
    }: {
      eventSummary?: string;
      hostConfig: HostConfig;
      boardContext?: string;
      directScript?: string;
    } = body;

    if (!hostConfig || !hostConfig.enabled) {
      return NextResponse.json({ skipped: true });
    }

    const ai = getServerGeminiClient();
    const { systemPrompt, speechStyle } = buildHostSystemInstruction(
      hostConfig,
      boardContext
    );

    let spokenLine = directScript?.trim() || '';

    if (!spokenLine) {
      const textResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `React in-character (1 to 2 short, punchy sentences max, suitable for spoken broadcast) to this Grand Estates 3D Monopoly game event: "${eventSummary || 'The dice are rolling on the board!'}". You may optionally include one expressive vocal tag such as <laugh>, <gasp>, or <breath> if it fits naturally. Do not include stage directions in asterisks or quotation marks.`,
        config: {
          systemInstruction: systemPrompt,
        },
      });
      spokenLine =
        (textResponse.text || '').trim() ||
        eventSummary ||
        'Welcome to Grand Estates 3D!';
    }

    // Generate expressive TTS using gemini-3.8-flash-tts
    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: spokenLine,
              speechMetadata: {
                style: speechStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: hostConfig.voiceName || 'Kore',
            },
          },
        },
      },
    });

    const base64Audio =
      ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    // Strip any raw XML tags like <laugh> from the visible UI transcript while keeping the text clean
    const cleanTranscript = spokenLine
      .replace(/<(laugh|gasp|breath)>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return NextResponse.json({
      transcript: cleanTranscript,
      rawScript: spokenLine,
      audioBase64: base64Audio || null,
      mimeType: 'audio/wav',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to synthesize AI Host commentary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
