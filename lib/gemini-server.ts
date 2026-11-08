import { GoogleGenAI } from '@google/genai';
import {
  HostConfig,
  PERSONALITY_PRESETS,
} from './monopoly-data';

export function getServerGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function buildHostSystemInstruction(
  hostConfig: HostConfig,
  boardContext?: string
): { systemPrompt: string; speechStyle: string } {
  const preset =
    PERSONALITY_PRESETS.find((p) => p.id === hostConfig.personalityPreset) ||
    PERSONALITY_PRESETS[0];

  const genderLabel = hostConfig.gender === 'MALE' ? 'Male' : 'Female';
  const customAddendum =
    hostConfig.personalityPreset === 'CUSTOM' &&
    hostConfig.customPersonalityPrompt.trim()
      ? `\nUser-defined custom personality: "${hostConfig.customPersonalityPrompt.trim()}"`
      : hostConfig.customPersonalityPrompt.trim()
      ? `\nAdditional style note: "${hostConfig.customPersonalityPrompt.trim()}"`
      : '';

  const contextAddendum = boardContext
    ? `\nCurrent Monopoly Board Context:\n${boardContext}`
    : '';

  return {
    systemPrompt: `${preset.systemPrompt}\nYou are speaking as a ${genderLabel} AI Game Host (${hostConfig.voiceName}).${customAddendum}${contextAddendum}`,
    speechStyle:
      hostConfig.personalityPreset === 'CUSTOM' &&
      hostConfig.customPersonalityPrompt.trim()
        ? hostConfig.customPersonalityPrompt.trim().slice(0, 120)
        : preset.speechStyle,
  };
}
