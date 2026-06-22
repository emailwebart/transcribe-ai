-- Supabase Database Schema for TranscribeAI

-- 1. Create the transcriptions table
CREATE TABLE IF NOT EXISTS public.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    transcript_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for transcriptions
CREATE POLICY "Users can view their own transcriptions"
    ON public.transcriptions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transcriptions"
    ON public.transcriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transcriptions"
    ON public.transcriptions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transcriptions"
    ON public.transcriptions
    FOR DELETE
    USING (auth.uid() = user_id);


-- 4. Storage Bucket Setup Instructions & Policies
-- Note: Make sure to create a bucket named 'audio-uploads' in the Supabase Storage console first.
-- You can make the bucket 'Public'. 
--
-- Below are the SQL commands to configure storage policies for 'audio-uploads' bucket if needed:

/*
-- Allow public read access to uploaded files
CREATE POLICY "Public Read Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'audio-uploads');

-- Allow authenticated users to upload files to their own folder inside the bucket
CREATE POLICY "Authenticated User Upload Access"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'audio-uploads' 
        AND auth.role() = 'authenticated'
    );

-- Allow users to delete their own uploaded files
CREATE POLICY "Authenticated User Delete Access"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'audio-uploads'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
*/
