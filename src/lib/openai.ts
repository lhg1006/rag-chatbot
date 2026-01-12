import OpenAI from 'openai';
import { ChunkReference } from '@/types/rag';

let openaiInstance: OpenAI | null = null;

export function getOpenAI(apiKey: string): OpenAI {
  if (!openaiInstance || openaiInstance.apiKey !== apiKey) {
    openaiInstance = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }
  return openaiInstance;
}

export async function createEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  const openai = getOpenAI(apiKey);

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

export async function createEmbeddings(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  const openai = getOpenAI(apiKey);

  // 배치 처리 (최대 100개씩)
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });

    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

export async function* streamChat(
  apiKey: string,
  question: string,
  context: ChunkReference[]
): AsyncGenerator<string, void, unknown> {
  const openai = getOpenAI(apiKey);

  const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
If the answer cannot be found in the context, say so clearly.
Always cite which part of the context you used for your answer.
Answer in Korean.`;

  const contextText = context
    .map((c, i) => `[출처 ${i + 1}: ${c.documentName}]\n${c.content}`)
    .join('\n\n---\n\n');

  const userPrompt = `Context:
${contextText}

Question: ${question}

위 컨텍스트를 바탕으로 질문에 답변해주세요. 답변에 사용한 출처를 명시해주세요.`;

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1000,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const openai = getOpenAI(apiKey);
    await openai.models.list();
    return true;
  } catch {
    return false;
  }
}
