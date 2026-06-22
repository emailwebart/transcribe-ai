import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Next.js App Router body size limit configuration (if needed)
export const maxDuration = 300; // 5 minutes max duration for serverless functions

const runCompression = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'compress.py'),
      inputPath,
      outputPath
    ]);

    let stderr = '';
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python compression script failed with code ${code}. Error: ${stderr}`));
      }
    });
  });
};

export async function POST(request) {
  let tempInputPath = null;
  let tempOutputPath = null;
  let supabase = null;
  let dbRecordId = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('userId');

    if (!file || !userId) {
      return NextResponse.json({ error: 'File and User ID are required' }, { status: 400 });
    }

    // Initialize Supabase Client using the client's Auth token to respect RLS
    const authHeader = request.headers.get('Authorization');
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader || ''
          }
        }
      }
    );

    const originalFileName = file.name;
    const fileExt = originalFileName.split('.').pop();
    const fileSize = file.size;

    // Define temp folder path
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Convert file to buffer and write to temp input path
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = `${userId}_${Date.now()}`;
    tempInputPath = path.join(tempDir, `input_${fileId}.${fileExt}`);
    fs.writeFileSync(tempInputPath, buffer);

    let uploadBuffer = buffer;
    let uploadFileName = `${userId}/${Date.now()}.${fileExt}`;
    let isCompressed = false;

    // Check size limit: 50MB is 50 * 1024 * 1024 bytes
    const FIFTY_MB = 50 * 1024 * 1024;
    if (fileSize > FIFTY_MB) {
      console.log(`File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) is greater than 50MB. Compressing...`);
      tempOutputPath = path.join(tempDir, `compressed_${fileId}.mp3`);
      
      // Run the Python compression script
      await runCompression(tempInputPath, tempOutputPath);
      
      // Read compressed file
      uploadBuffer = fs.readFileSync(tempOutputPath);
      uploadFileName = `${userId}/${Date.now()}_compressed.mp3`;
      isCompressed = true;
      console.log(`Compression complete. New file size: ${(uploadBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // 1. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-uploads')
      .upload(uploadFileName, uploadBuffer, {
        contentType: isCompressed ? 'audio/mpeg' : file.type,
        duplex: 'half'
      });

    if (uploadError) {
      throw new Error(`Storage Upload Failed: ${uploadError.message}`);
    }

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio-uploads')
      .getPublicUrl(uploadFileName);

    // 3. Create initial database record in 'processing' status
    const { data: dbRecord, error: dbError } = await supabase
      .from('transcriptions')
      .insert([{
        user_id: userId,
        title: originalFileName,
        audio_url: publicUrl,
        status: 'processing'
      }])
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database Insert Failed: ${dbError.message}`);
    }

    dbRecordId = dbRecord.id;

    // 4. Call Deepgram API for transcription
    const response = await fetch('https://api.deepgram.com/v1/listen?smart_format=true&model=nova-3&diarize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: publicUrl })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.err_msg || 'Deepgram API error');
    }

    const dgResult = await response.json();

    // Parse transcript text
    let finalTranscript = 'No text detected.';
    if (dgResult.results?.channels?.length > 0) {
      const paragraphs = dgResult.results.channels[0].alternatives[0].paragraphs;
      if (paragraphs) {
        finalTranscript = paragraphs.transcript;
      } else {
        finalTranscript = dgResult.results.channels[0].alternatives[0].transcript;
      }
    }

    // 5. Update Database with Success status and transcript text
    const { data: finalRecord, error: updateError } = await supabase
      .from('transcriptions')
      .update({ transcript_text: finalTranscript, status: 'completed' })
      .eq('id', dbRecordId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Final Database Update Failed: ${updateError.message}`);
    }

    // Clean up temp files
    try {
      if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (cleanupErr) {
      console.error('Error cleaning up temp files:', cleanupErr);
    }

    return NextResponse.json(finalRecord);

  } catch (error) {
    console.error('Upload & Transcribe route error:', error);

    // If database record was created, mark it as failed
    if (supabase && dbRecordId) {
      try {
        await supabase
          .from('transcriptions')
          .update({ status: 'failed', transcript_text: `Error: ${error.message}` })
          .eq('id', dbRecordId);
      } catch (dbErr) {
        console.error('Failed to update transcription status to failed:', dbErr);
      }
    }

    // Clean up temp files
    try {
      if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (tempOutputPath && fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (cleanupErr) {
      console.error('Error cleaning up temp files in catch block:', cleanupErr);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
