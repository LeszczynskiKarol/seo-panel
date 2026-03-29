import { FastifyInstance } from "fastify";
import { ChatService } from "../services/chat.service.js";
import { prisma } from "../lib/prisma.js";

const chat = new ChatService();

export async function chatRoutes(fastify: FastifyInstance) {
  // List conversations
  fastify.get("/conversations", async () => {
    return prisma.chatConversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true, role: true },
        },
        _count: { select: { messages: true } },
      },
    });
  });

  // Get single conversation with all messages
  fastify.get("/conversations/:id", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.chatConversation.findUniqueOrThrow({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  });

  // Delete conversation
  fastify.delete("/conversations/:id", async (request) => {
    const { id } = request.params as { id: string };
    await prisma.chatConversation.delete({ where: { id } });
    return { ok: true };
  });

  // Send message (creates conversation if needed)
  fastify.post("/", async (request) => {
    const { question, conversationId } = request.body as {
      question: string;
      conversationId?: string;
    };
    if (!question?.trim()) throw new Error("Question required");

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await prisma.chatConversation.create({
        data: {
          title: question.slice(0, 80) + (question.length > 80 ? "..." : ""),
        },
      });
      convId = conv.id;
    }

    // Save user message
    await prisma.chatMessage.create({
      data: { conversationId: convId, role: "user", content: question },
    });

    // Load history from DB (last 20 messages for context)
    const dbMessages = await prisma.chatMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    // Call Claude
    const history = dbMessages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const result = await chat.chat(question, history);

    // Save assistant message
    await prisma.chatMessage.create({
      data: {
        conversationId: convId,
        role: "assistant",
        content: result.answer,
        matchedDomain: result.matchedDomain,
        inputTokens: result.usage?.input_tokens,
        outputTokens: result.usage?.output_tokens,
        durationMs: result.durationMs,
      },
    });

    // Update conversation title & timestamp
    await prisma.chatConversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() },
    });

    return {
      ...result,
      conversationId: convId,
    };
  });
}
