import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
