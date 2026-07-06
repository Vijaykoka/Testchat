export interface ChunkRecord {
  id: string;
  text: string;
  page: number;
  source: string;
  title: string;
}

import chunksData from '@/data/chunks.json';

const chunks: ChunkRecord[] = chunksData as ChunkRecord[];

const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const CHAT_MODEL = 'meta/llama-3.1-8b-instruct';

function getSourceDisplayName(filename: string): string {
  const match = filename.match(/pneg-?\d+/i);
  if (match) return `PNEG-${match[0].replace(/pneg-?/i, '')}`;
  return filename.replace(/\.pdf$/i, '');
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function bm25Similarity(query: string, doc: string): number {
  const queryTokens = tokenize(query);
  const docTokens = tokenize(doc);
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  const docFreq: Record<string, number> = {};
  for (const t of docTokens) docFreq[t] = (docFreq[t] || 0) + 1;

  const docLen = docTokens.length;
  const avgDocLen = 200;
  const k1 = 1.5;
  const b = 0.75;

  let score = 0;
  for (const q of queryTokens) {
    const tf = docFreq[q] || 0;
    if (tf === 0) continue;
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
    score += Math.log(1 + 1 / 1) * (numerator / denominator);
  }
  return score;
}

export function findRelevantChunks(query: string, topK = 5) {
  return chunks
    .map(c => ({ ...c, score: bm25Similarity(query, c.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(c => c.score > 0);
}

export function buildContext(chunks: { text: string; page: number; source: string; title: string; score: number }[]): string {
  return chunks.map(c => `[${getSourceDisplayName(c.source)} - Page ${c.page}]\n${c.text}`).join('\n\n');
}

function getSourceList(chunks: { source: string }[]): string {
  return [...new Set(chunks.map(c => getSourceDisplayName(c.source)))].join(', ');
}

export async function generateAnswer(
  question: string,
  context: string,
  sources: { source: string }[],
  history: { role: 'user' | 'assistant'; content: string }[] = [],
) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey || apiKey === 'nvapi-your-key-here') {
    return generateFallbackAnswer(question, context, sources);
  }

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey, baseURL: NVIDIA_BASE_URL });

    const sourceList = getSourceList(sources);

    const messages = [
      {
        role: 'system' as const,
        content: `You are an AI assistant for Tanzroft LLC. Answer customer questions using ONLY the provided context from the product manuals and documentation. If the answer is not in the context, say "I don't have that information from the available documentation." Be concise and helpful. Always reference the source document name when answering.`,
      },
      {
        role: 'system' as const,
        content: `Relevant context from the following sources: ${sourceList}\n\n${context}`,
      },
      ...history,
      { role: 'user' as const, content: question },
    ];

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 512,
      messages,
    });

    return response.choices[0]?.message?.content ?? "I couldn't generate an answer. Please try rephrasing.";
  } catch {
    return generateFallbackAnswer(question, context, sources);
  }
}

function generateFallbackAnswer(question: string, context: string, sources: { source: string }[]): string {
  const questionLower = question.toLowerCase();
  const sentences = context.split(/\.\s+/);
  const relevant = sentences.filter(s => {
    const qTokens = tokenize(questionLower);
    const sLower = s.toLowerCase();
    return qTokens.some(t => t.length > 2 && sLower.includes(t));
  });

  const sourceList = getSourceList(sources);

  if (relevant.length > 0) {
    return `Based on the documentation (${sourceList}):\n\n${relevant.slice(0, 3).join('. ')}.`;
  }

  return `I found this information in the documentation (${sourceList}):\n\n${context.slice(0, 500)}...`;
}
