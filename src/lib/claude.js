import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

export const MODEL = "claude-haiku-4-5";
