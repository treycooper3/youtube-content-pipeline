"""
Transcribe Video - Whisper API Word-Level Transcription

Extracts audio from video using FFmpeg, then transcribes with OpenAI Whisper API
to produce word-level timestamps compatible with CaptionToken format.

Usage:
    python transcribe_video.py input.mp4
    python transcribe_video.py input.mp4 --output .tmp/transcript_my_video.json
    python transcribe_video.py input.mp4 --dry-run

Output format:
    {
        "words": [
            {"text": "Hey", "startMs": 1200, "endMs": 1450, "confidence": 0.98},
            ...
        ],
        "full_text": "Hey everyone welcome to...",
        "duration_seconds": 1842.5,
        "language": "en",
        "metadata": { ... }
    }

Requirements:
    - FFmpeg installed (brew install ffmpeg)
    - OPENAI_API_KEY in .env
    - openai Python package

Author: WAT Framework
Last Updated: 2026-02-16
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
MAX_FILE_SIZE_MB = 25  # Whisper API limit
SUPPORTED_AUDIO_FORMATS = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm']

# Circuit breakers
CIRCUIT_BREAKER = {
    "max_retries": 3,
    "timeout_seconds": 300,
    "max_file_size_mb": MAX_FILE_SIZE_MB,
}


def check_ffmpeg():
    """Verify FFmpeg is installed."""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True, text=True
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using FFmpeg."""
    cmd = [
        'ffprobe', '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        data = json.loads(result.stdout)
        return float(data['format']['duration'])
    return 0.0


def extract_audio(video_path: str, output_path: str) -> bool:
    """
    Extract audio from video as WAV for Whisper API.

    Uses 16kHz mono WAV which is optimal for Whisper.
    """
    cmd = [
        'ffmpeg', '-i', video_path,
        '-vn',                    # No video
        '-acodec', 'pcm_s16le',  # 16-bit PCM
        '-ar', '16000',           # 16kHz sample rate
        '-ac', '1',               # Mono
        '-y',                     # Overwrite
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  FFmpeg error: {result.stderr}")
        return False
    return True


def split_audio_for_api(audio_path: str, max_size_mb: int = 25) -> list[str]:
    """
    Split audio file into chunks if it exceeds the API size limit.

    Returns list of chunk file paths.
    """
    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)

    if file_size_mb <= max_size_mb:
        return [audio_path]

    # Calculate number of chunks needed
    num_chunks = int(file_size_mb / max_size_mb) + 1

    # Get total duration
    cmd = [
        'ffprobe', '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        audio_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    total_duration = float(json.loads(result.stdout)['format']['duration'])
    chunk_duration = total_duration / num_chunks

    chunks = []
    temp_dir = os.path.dirname(audio_path)

    for i in range(num_chunks):
        start_time = i * chunk_duration
        chunk_path = os.path.join(temp_dir, f"chunk_{i:03d}.wav")

        cmd = [
            'ffmpeg', '-i', audio_path,
            '-ss', str(start_time),
            '-t', str(chunk_duration),
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-y',
            chunk_path
        ]
        subprocess.run(cmd, capture_output=True, text=True)
        chunks.append(chunk_path)

    print(f"  Split into {len(chunks)} chunks ({chunk_duration:.0f}s each)")
    return chunks


def transcribe_with_api(audio_path: str, chunk_offset_ms: int = 0) -> dict:
    """
    Transcribe audio using OpenAI Whisper API with word-level timestamps.

    Args:
        audio_path: Path to audio file
        chunk_offset_ms: Time offset in ms for this chunk (for multi-chunk files)

    Returns:
        Dict with 'words' list and 'text'
    """
    try:
        from openai import OpenAI
    except ImportError:
        print("Error: openai package not installed. Run: pip install openai")
        sys.exit(1)

    client = OpenAI(api_key=OPENAI_API_KEY)

    with open(audio_path, 'rb') as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["word"]
        )

    words = []
    if hasattr(response, 'words') and response.words:
        for w in response.words:
            words.append({
                "text": w.word.strip(),
                "startMs": int(w.start * 1000) + chunk_offset_ms,
                "endMs": int(w.end * 1000) + chunk_offset_ms,
            })

    return {
        "words": words,
        "text": response.text if hasattr(response, 'text') else "",
    }


def transcribe_video(video_path: str, output_path: str = None, dry_run: bool = False) -> dict:
    """
    Full transcription pipeline: video → audio → Whisper API → word timestamps.

    Args:
        video_path: Path to video file
        output_path: Optional output JSON path
        dry_run: If True, estimate cost without running

    Returns:
        Transcript dict with words, full_text, metadata
    """
    video_path = os.path.abspath(video_path)

    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)

    # Get video info
    duration = get_video_duration(video_path)
    file_size_mb = os.path.getsize(video_path) / (1024 * 1024)

    print(f"Video: {os.path.basename(video_path)}")
    print(f"  Duration: {duration:.1f}s ({duration/60:.1f} min)")
    print(f"  File size: {file_size_mb:.1f} MB")

    # Cost estimate (Whisper API: $0.006/minute)
    cost_estimate = (duration / 60) * 0.006
    print(f"  Estimated API cost: ${cost_estimate:.4f}")

    if dry_run:
        print("\n  [DRY RUN] No transcription performed.")
        return {"words": [], "full_text": "", "cost_estimate": cost_estimate}

    if not OPENAI_API_KEY:
        print("\nError: OPENAI_API_KEY not found in .env")
        print("Add it to your .env file: OPENAI_API_KEY=sk-...")
        sys.exit(1)

    # Extract audio to temp file
    print("\n  Extracting audio...")
    with tempfile.TemporaryDirectory() as temp_dir:
        audio_path = os.path.join(temp_dir, "audio.wav")

        if not extract_audio(video_path, audio_path):
            print("Error: Failed to extract audio")
            sys.exit(1)

        audio_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        print(f"  Audio extracted: {audio_size_mb:.1f} MB")

        # Split if needed
        chunks = split_audio_for_api(audio_path)

        # Transcribe each chunk
        all_words = []
        all_text = []

        for i, chunk_path in enumerate(chunks):
            if len(chunks) > 1:
                print(f"\n  Transcribing chunk {i+1}/{len(chunks)}...")
            else:
                print("\n  Transcribing with Whisper API...")

            # Calculate offset for this chunk
            if i > 0 and all_words:
                chunk_offset_ms = all_words[-1]["endMs"]
            else:
                chunk_offset_ms = 0

            result = transcribe_with_api(chunk_path, chunk_offset_ms)
            all_words.extend(result["words"])
            all_text.append(result["text"])

    # Build output
    transcript = {
        "words": all_words,
        "full_text": " ".join(all_text),
        "duration_seconds": duration,
        "language": "en",
        "metadata": {
            "source_file": video_path,
            "transcription_date": datetime.now().isoformat(),
            "engine": "openai-whisper-api",
            "model": "whisper-1",
            "word_count": len(all_words),
            "cost_estimate": cost_estimate,
        }
    }

    # Save output
    if output_path is None:
        project_name = Path(video_path).stem
        os.makedirs('.tmp', exist_ok=True)
        output_path = f".tmp/transcript_{project_name}.json"

    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(transcript, f, indent=2)

    print(f"\n  Transcript saved: {output_path}")
    print(f"  Words: {len(all_words)}")
    print(f"  Full text length: {len(transcript['full_text'])} chars")

    return transcript


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe video with word-level timestamps using Whisper API"
    )
    parser.add_argument(
        "video",
        help="Path to video file"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output JSON path (default: .tmp/transcript_{name}.json)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Estimate cost without transcribing"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Transcribe Video - WAT Framework")
    print("=" * 60)

    # Check prerequisites
    if not check_ffmpeg():
        print("Error: FFmpeg not installed. Run: brew install ffmpeg")
        sys.exit(1)

    transcribe_video(
        video_path=args.video,
        output_path=args.output,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
