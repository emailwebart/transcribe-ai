import sys
import os
import subprocess

def compress_media(input_path, output_path):
    """
    Compresses audio or video files into a highly compressed mono MP3 file.
    -vn removes video stream (critical for compression of video files)
    -ac 1 sets audio to mono channel
    -ar 16000 sets sample rate to 16kHz (optimal for speech recognition)
    -b:a 64k sets audio bitrate to 64kbps (excellent balance of size and quality for transcription)
    """
    try:
        # Construct FFmpeg command
        cmd = [
            'ffmpeg',
            '-y',               # Overwrite output file if it exists
            '-i', input_path,   # Input file
            '-vn',              # Disable video
            '-ac', '1',         # Mono channel
            '-ar', '16000',     # 16kHz sampling rate
            '-b:a', '64k',      # 64kbps bitrate
            output_path
        ]
        
        print(f"Executing: {' '.join(cmd)}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if result.returncode != 0:
            print(f"FFmpeg Error output: {result.stderr}", file=sys.stderr)
            return False
            
        print("FFmpeg compression completed successfully.")
        return True
        
    except Exception as e:
        print(f"Exception during compression: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python compress.py <input_path> <output_path>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Error: Input file does not exist: {input_file}", file=sys.stderr)
        sys.exit(1)
        
    success = compress_media(input_file, output_file)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
