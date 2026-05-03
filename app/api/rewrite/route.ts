import { NextRequest, NextResponse } from 'next/server';

const HF_MODEL = 'HuggingFaceH4/zephyr-7b-beta';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

type HFGenerated = { generated_text?: string };

type HFChatCompletion = {
  choices?: Array<{
    message?: { content?: string };
    text?: string;
  }>;
};

function getCorsHeaders() {
  return {
    // This endpoint accepts public prompts only and does not use cookies or
    // browser credentials. Wildcard CORS avoids custom-domain/origin mismatch
    // problems between the static SMM site and the Writers Room proxy.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(),
      ...(init?.headers || {}),
    },
  });
}

async function readPrompt(req: NextRequest): Promise<string> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json() as { prompt?: string };
    return typeof body.prompt === 'string' ? body.prompt : '';
  }

  if (contentType.includes('text/plain')) {
    return (await req.text()).trim();
  }

  // Be permissive for simple cross-origin requests where the browser omits
  // or changes the content type.
  const raw = await req.text();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as { prompt?: string };
    return typeof parsed.prompt === 'string' ? parsed.prompt : raw;
  } catch {
    return raw.trim();
  }
}

function extractGeneratedText(data: unknown): string {
  if (Array.isArray(data)) {
    const first = data[0] as HFGenerated | undefined;
    return first?.generated_text || '';
  }

  if (data && typeof data === 'object') {
    const obj = data as HFGenerated & HFChatCompletion;
    if (typeof obj.generated_text === 'string') return obj.generated_text;

    const firstChoice = obj.choices?.[0];
    if (typeof firstChoice?.message?.content === 'string') return firstChoice.message.content;
    if (typeof firstChoice?.text === 'string') return firstChoice.text;
  }

  return '';
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return json({ error: 'HF_TOKEN not configured' }, { status: 500 });
  }

  let prompt = '';
  try {
    prompt = await readPrompt(req);
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!prompt) {
    return json({ error: 'prompt required' }, { status: 400 });
  }

  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 800,
        temperature: 0.3,
        return_full_text: false,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const generated_text = extractGeneratedText(data);

  if (!generated_text) {
    return json(
      {
        error: 'No generated text returned from HuggingFace',
        provider_shape: Array.isArray(data) ? 'array' : typeof data,
      },
      { status: 502 },
    );
  }

  return json({
    generated_text,
    provider: 'huggingface',
    model: HF_MODEL,
  });
}
