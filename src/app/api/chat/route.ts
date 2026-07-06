import { findRelevantChunks, buildContext, generateAnswer } from '@/lib/rag';

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json() as { message: string; history?: { role: 'user' | 'assistant'; content: string }[] };

    if (!message?.trim()) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    const relevant = findRelevantChunks(message);
    const context = buildContext(relevant);
    const answer = await generateAnswer(message, context, relevant, history);

    return Response.json({
      answer,
      sources: relevant.map(r => ({
        source: r.source,
        page: r.page,
        title: r.title,
        score: r.score,
        snippet: r.text.slice(0, 150),
      })),
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return Response.json(
      { error: 'Failed to process your request.' },
      { status: 500 },
    );
  }
}
