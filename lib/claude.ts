import Anthropic from '@anthropic-ai/sdk';
import { getRouteHandlerSupabaseClient } from './supabase-server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateAssistantResponse(
  messages: ChatMessageInput[],
  assistantConfig: {
    name: string;
    personality: string;
    system_prompt?: string;
  },
  products?: Array<{ name: string; description: string; price: number }>,
) {
  const productContext = products
    ? `\n\nDisponível para venda:\n${products.map((p) => `- ${p.name}: R$ ${p.price.toFixed(2)} - ${p.description}`).join('\n')}`
    : '';

  const systemPrompt = `Você é o assistente de vendas chamado ${assistantConfig.name}.

Personalidade: ${assistantConfig.personality}

${assistantConfig.system_prompt || ''}${productContext}

Seu objetivo é:
1. Ajudar o cliente a encontrar o produto perfeito
2. Responder perguntas sobre os produtos
3. Sugerir adicionais quando apropriado
4. Ser amigável e envolvente
5. Guiar o cliente para a compra`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return {
      message: textContent.text,
      stop_reason: response.stop_reason,
    };
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

export async function saveChatMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
) {
  const supabase = await getRouteHandlerSupabaseClient();

  const { error } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role,
    content,
  });

  if (error) throw error;
}

export async function getChatHistory(sessionId: string) {
  const supabase = await getRouteHandlerSupabaseClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createChatSession(workspaceId: string, customerSessionId: string) {
  const supabase = await getRouteHandlerSupabaseClient();

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      workspace_id: workspaceId,
      customer_session_id: customerSessionId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAssistantSettings(workspaceId: string) {
  const supabase = await getRouteHandlerSupabaseClient();

  const { data, error } = await supabase
    .from('assistant_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error) throw error;
  return data;
}
