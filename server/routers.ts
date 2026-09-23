import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { addChatMessage, createConversation, getConversation, listChatMessages, listConversations, updateConversationModel } from "./db";
import { completeOmegaAssistant, MODEL_OPTIONS, type ChatModel } from "./assistant";

const clientIdSchema = z.string().min(16).max(128);
const modelSchema = z.enum(MODEL_OPTIONS.map((option) => option.id) as [ChatModel, ...ChatModel[]]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  chat: router({
    models: publicProcedure.query(() => MODEL_OPTIONS),
    conversations: publicProcedure.input(z.object({ clientId: clientIdSchema })).query(({ input }) => listConversations(input.clientId)),
    messages: publicProcedure.input(z.object({ clientId: clientIdSchema, conversationId: z.number().int().positive() })).query(({ input }) => listChatMessages(input.clientId, input.conversationId)),
    create: publicProcedure.input(z.object({ clientId: clientIdSchema, title: z.string().max(180).optional(), model: modelSchema })).mutation(({ input }) => createConversation(input.clientId, input.title || "New OMEGA chat", input.model)),
    setModel: publicProcedure.input(z.object({ clientId: clientIdSchema, conversationId: z.number().int().positive(), model: modelSchema })).mutation(async ({ input }) => {
      const conversation = await getConversation(input.clientId, input.conversationId);
      if (!conversation) throw new Error("Conversation not found.");
      await updateConversationModel(input.clientId, input.conversationId, input.model);
      return { model: input.model };
    }),
    ask: publicProcedure.input(z.object({ clientId: clientIdSchema, conversationId: z.number().int().positive(), model: modelSchema, prompt: z.string().trim().min(1).max(12000) })).mutation(async ({ input }) => {
      const conversation = await getConversation(input.clientId, input.conversationId);
      if (!conversation) throw new Error("Conversation not found.");
      const history = await listChatMessages(input.clientId, input.conversationId);
      const messages = [...history.map((message) => ({ role: message.role, content: message.content })), { role: "user" as const, content: input.prompt }];
      await addChatMessage({ conversationId: input.conversationId, role: "user", content: input.prompt, model: input.model });
      try {
        const result = await completeOmegaAssistant({ model: input.model, messages });
        await addChatMessage({ conversationId: input.conversationId, role: "assistant", content: result.content, model: result.model });
        return result;
      } catch (error) {
        throw error;
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
