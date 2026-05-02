import { NextRequest, NextResponse } from 'next/server';

const HF_MODEL = 'HuggingFaceH4/zephyr-7b-beta';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const ALLOWED_ORIGINS = new Set([
  'https://smm.fredericlabadie.com',
  'https://writersroom.fredericlabadie.com',
  'http://localhost:3000',
  'http://localhost:4200',
]);

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
  return json(req, data);
}
