import { NextRequest, NextResponse } from 'next/server';

const HF_MODEL = 'HuggingFaceH4/zephyr-7b-beta';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const ALLOWED_ORIGINS = new Set([
  'https://smm.fredericlabadie.com',
  'https://writersroom.fredericlabadie.com',
  'http://localhost:3000',
  'http://localhost:4200',
]);

type HFGenerated = { generated_text?: string };

type HFChatCompletion = {
  choices?: Array<{
    message?: { content?: string };
    text?: string;
  }>;
};

function getCorsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://smm.fredericlabadie.com';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(req: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(req),
      ...(init?.headers || {}),
    },
  });
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

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return json(req, { error: 'HF_TOKEN not configured' }, { status: 500 });
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.prompt) {
    return json(req, { error: 'prompt required' }, { status: 400 });
  }

  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: body.prompt,
      parameters: {
        max_new_tokens: 800,
        temperature: 0.3,
        return_full_text: false,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json(req, { error: err }, { status: res.status });
  }

  const data = await res.json();
  const generated_text = extractGeneratedText(data);

  if (!generated_text) {
    return json(
      req,
      {
        error: 'No generated text returned from HuggingFace',
        provider_shape: Array.isArray(data) ? 'array' : typeof data,
      },
      { status: 502 },
    );
  }

  return json(req, {
    generated_text,
    provider: 'huggingface',
    model: HF_MODEL,
  });
}
