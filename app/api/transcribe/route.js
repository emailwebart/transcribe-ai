import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 });
    }

    const response = await fetch('https://api.deepgram.com/v1/listen?smart_format=true&model=nova-3&diarize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: audioUrl })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.err_msg || 'Deepgram API error');
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
