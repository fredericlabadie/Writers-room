import { NextRequest, NextResponse } from 'next/server';

const HF_MODEL = 'HuggingFaceH4/zephyr-7b-beta';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

export async function POST(req: NextRequest) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'HF_TOKEN not configured' }, { status: 500 });
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.prompt) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 });
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
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
