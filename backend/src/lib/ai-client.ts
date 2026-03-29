// backend/src/lib/ai-client.ts

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Pricing per 1M tokens (as of 2025)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

function calcCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] || { input: 3, output: 15 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function aiCall(opts: {
  model?: string;
  messages: Anthropic.MessageParam[];
  system?: string; // ← DODAJ
  max_tokens?: number;
  feature: string;
  domainId?: string;
  domainLabel?: string;
}): Promise<Anthropic.Message> {
  const model = opts.model || "claude-sonnet-4-6";
  const start = Date.now();
  let log: any = {
    provider: "anthropic",
    model,
    endpoint: "messages.create",
    feature: opts.feature,
    domainId: opts.domainId,
    domainLabel: opts.domainLabel,
    promptPreview: JSON.stringify(opts.messages).slice(0, 500),
  };

  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: opts.max_tokens || 4000,
      messages: opts.messages,
      ...(opts.system ? { system: opts.system } : {}), // ← DODAJ
    });

    const durationMs = Date.now() - start;
    const inputTokens = msg.usage.input_tokens;
    const outputTokens = msg.usage.output_tokens;
    const costUsd = calcCost(model, inputTokens, outputTokens);
    const responseText = msg.content.find((c) => c.type === "text")?.text || "";

    await prisma.apiLog.create({
      data: {
        ...log,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd,
        durationMs,
        responsePreview: responseText.slice(0, 500),
        status: "OK",
        metadata: { stopReason: msg.stop_reason },
      },
    });

    return msg;
  } catch (error: any) {
    const durationMs = Date.now() - start;
    await prisma.apiLog.create({
      data: {
        ...log,
        durationMs,
        status: "ERROR",
        error: error.message?.slice(0, 500),
      },
    });
    throw error;
  }
}
