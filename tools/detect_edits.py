"""
Detect Edits - Silence Detection and Edit Point Analysis

Analyzes raw video footage to identify:
  - Silent sections to cut or speed up
  - Filler words (um, uh, like, you know) from transcript
  - Natural break points for scene transitions

Uses FFmpeg silencedetect filter for audio analysis.

Usage:
    python detect_edits.py input.mp4
    python detect_edits.py input.mp4 --transcript .tmp/transcript.json
    python detect_edits.py input.mp4 --silence-threshold -30 --min-silence 0.8

Output format:
    {
        "edit_decisions": [
            {"type": "cut", "start_ms": 15200, "end_ms": 17800, "reason": "silence"},
            {"type": "speed_up", "start_ms": 45600, "end_ms": 46200, "speed": 3.0, "reason": "short_pause"},
            {"type": "cut", "start_ms": 52100, "end_ms": 52800, "reason": "filler_word"},
            ...
        ],
        "segments": [
            {"start_ms": 0, "end_ms": 15200, "type": "keep"},
            {"start_ms": 17800, "end_ms": 45600, "type": "keep"},
            ...
        ],
        "stats": { ... }
    }

Requirements:
    - FFmpeg installed (brew install ffmpeg)

Author: WAT Framework
Last Updated: 2026-02-16
"""

import os
import sys
import json
import re
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Default thresholds
DEFAULT_NOISE_DB = -30       # Silence threshold in dB
DEFAULT_MIN_SILENCE = 0.8    # Minimum silence duration in seconds
SPEED_UP_THRESHOLD = 1.5     # Silences shorter than this get sped up instead of cut
FILLER_WORDS = {"um", "uh", "uhm", "uhh", "hmm", "like", "you know", "basically", "literally", "actually", "so yeah"}


def check_ffmpeg():
    """Verify FFmpeg is installed."""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False


def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds."""
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


def detect_silence(video_path: str, noise_db: int = DEFAULT_NOISE_DB, min_silence: float = DEFAULT_MIN_SILENCE) -> list[dict]:
    """
    Detect silent sections in video using FFmpeg silencedetect.

    Args:
        video_path: Path to video file
        noise_db: Noise threshold in dB (default: -30)
        min_silence: Minimum silence duration in seconds (default: 0.8)

    Returns:
        List of {start_ms, end_ms, duration_ms} dicts for each silence region
    """
    cmd = [
        'ffmpeg', '-i', video_path,
        '-af', f'silencedetect=noise={noise_db}dB:d={min_silence}',
        '-f', 'null', '-'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stderr  # FFmpeg outputs to stderr

    # Parse silence_start and silence_end from FFmpeg output
    silences = []
    current_start = None

    for line in output.split('\n'):
        start_match = re.search(r'silence_start: ([\d.]+)', line)
        end_match = re.search(r'silence_end: ([\d.]+)', line)

        if start_match:
            current_start = float(start_match.group(1))

        if end_match and current_start is not None:
            end_time = float(end_match.group(1))
            silences.append({
                "start_ms": int(current_start * 1000),
                "end_ms": int(end_time * 1000),
                "duration_ms": int((end_time - current_start) * 1000),
            })
            current_start = None

    return silences


def detect_filler_words(transcript_path: str) -> list[dict]:
    """
    Detect filler words from transcript with timestamps.

    Args:
        transcript_path: Path to transcript JSON from transcribe_video.py

    Returns:
        List of {start_ms, end_ms, word, reason} dicts
    """
    with open(transcript_path, 'r') as f:
        transcript = json.load(f)

    words = transcript.get("words", [])
    fillers = []

    for i, word in enumerate(words):
        text = word["text"].lower().strip(".,!?")

        if text in FILLER_WORDS:
            fillers.append({
                "start_ms": word["startMs"],
                "end_ms": word["endMs"],
                "word": word["text"],
                "reason": "filler_word",
            })

        # Check two-word fillers (e.g., "you know")
        if i < len(words) - 1:
            next_word = words[i + 1]["text"].lower().strip(".,!?")
            combined = f"{text} {next_word}"
            if combined in FILLER_WORDS:
                fillers.append({
                    "start_ms": word["startMs"],
                    "end_ms": words[i + 1]["endMs"],
                    "word": combined,
                    "reason": "filler_phrase",
                })

    return fillers


def build_edit_decisions(
    silences: list[dict],
    fillers: list[dict] = None,
    speed_up_threshold_ms: int = None,
) -> list[dict]:
    """
    Convert detected silences and fillers into edit decisions.

    Short silences (< threshold) → speed up 3x
    Long silences (>= threshold) → cut entirely
    Filler words → cut

    Args:
        silences: List of silence regions
        fillers: Optional list of filler word regions
        speed_up_threshold_ms: Silences below this get sped up (default: 1500ms)

    Returns:
        List of edit decision dicts, sorted by start_ms
    """
    if speed_up_threshold_ms is None:
        speed_up_threshold_ms = int(SPEED_UP_THRESHOLD * 1000)

    decisions = []

    for silence in silences:
        if silence["duration_ms"] < speed_up_threshold_ms:
            decisions.append({
                "type": "speed_up",
                "start_ms": silence["start_ms"],
                "end_ms": silence["end_ms"],
                "speed": 3.0,
                "reason": "short_pause",
            })
        else:
            decisions.append({
                "type": "cut",
                "start_ms": silence["start_ms"],
                "end_ms": silence["end_ms"],
                "reason": "silence",
            })

    if fillers:
        for filler in fillers:
            # Don't double-count if already covered by a silence
            overlaps = any(
                d["start_ms"] <= filler["start_ms"] and d["end_ms"] >= filler["end_ms"]
                for d in decisions
            )
            if not overlaps:
                decisions.append({
                    "type": "cut",
                    "start_ms": filler["start_ms"],
                    "end_ms": filler["end_ms"],
                    "reason": filler["reason"],
                    "word": filler.get("word"),
                })

    # Sort by start time
    decisions.sort(key=lambda d: d["start_ms"])

    return decisions


def build_keep_segments(decisions: list[dict], total_duration_ms: int) -> list[dict]:
    """
    Build the list of segments to keep (inverse of edit decisions).

    Args:
        decisions: Sorted list of edit decisions
        total_duration_ms: Total video duration in ms

    Returns:
        List of {start_ms, end_ms, type} segments to keep
    """
    segments = []
    current_pos = 0

    for decision in decisions:
        if decision["start_ms"] > current_pos:
            segments.append({
                "start_ms": current_pos,
                "end_ms": decision["start_ms"],
                "type": "keep",
            })

        if decision["type"] == "speed_up":
            segments.append({
                "start_ms": decision["start_ms"],
                "end_ms": decision["end_ms"],
                "type": "speed_up",
                "speed": decision.get("speed", 3.0),
            })

        current_pos = decision["end_ms"]

    # Add final segment
    if current_pos < total_duration_ms:
        segments.append({
            "start_ms": current_pos,
            "end_ms": total_duration_ms,
            "type": "keep",
        })

    return segments


def detect_edits(
    video_path: str,
    transcript_path: str = None,
    output_path: str = None,
    noise_db: int = DEFAULT_NOISE_DB,
    min_silence: float = DEFAULT_MIN_SILENCE,
) -> dict:
    """
    Full edit detection pipeline.

    Args:
        video_path: Path to video file
        transcript_path: Optional transcript JSON for filler word detection
        output_path: Optional output JSON path
        noise_db: Silence threshold dB
        min_silence: Minimum silence duration seconds

    Returns:
        Dict with edit_decisions, segments, and stats
    """
    video_path = os.path.abspath(video_path)

    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)

    duration = get_video_duration(video_path)
    total_duration_ms = int(duration * 1000)

    print(f"Video: {os.path.basename(video_path)}")
    print(f"  Duration: {duration:.1f}s ({duration/60:.1f} min)")
    print(f"  Silence threshold: {noise_db}dB, min duration: {min_silence}s")

    # Detect silences
    print("\n  Detecting silences...")
    silences = detect_silence(video_path, noise_db, min_silence)
    print(f"  Found {len(silences)} silent regions")

    # Detect filler words if transcript provided
    fillers = []
    if transcript_path and os.path.exists(transcript_path):
        print("  Detecting filler words...")
        fillers = detect_filler_words(transcript_path)
        print(f"  Found {len(fillers)} filler words/phrases")

    # Build edit decisions
    decisions = build_edit_decisions(silences, fillers)
    segments = build_keep_segments(decisions, total_duration_ms)

    # Calculate stats
    cut_time_ms = sum(
        d["end_ms"] - d["start_ms"]
        for d in decisions if d["type"] == "cut"
    )
    speedup_time_ms = sum(
        d["end_ms"] - d["start_ms"]
        for d in decisions if d["type"] == "speed_up"
    )
    # Time saved from speed-ups (2/3 of the duration at 3x speed)
    speedup_saved_ms = int(speedup_time_ms * 2 / 3)
    total_saved_ms = cut_time_ms + speedup_saved_ms
    estimated_output_ms = total_duration_ms - total_saved_ms

    stats = {
        "total_duration_ms": total_duration_ms,
        "cuts": sum(1 for d in decisions if d["type"] == "cut"),
        "speed_ups": sum(1 for d in decisions if d["type"] == "speed_up"),
        "filler_cuts": sum(1 for d in decisions if d.get("reason") in ("filler_word", "filler_phrase")),
        "time_cut_ms": cut_time_ms,
        "time_sped_up_ms": speedup_time_ms,
        "total_saved_ms": total_saved_ms,
        "estimated_output_ms": estimated_output_ms,
        "reduction_percent": round((total_saved_ms / total_duration_ms) * 100, 1) if total_duration_ms > 0 else 0,
    }

    print(f"\n  Edit Summary:")
    print(f"    Cuts: {stats['cuts']} ({cut_time_ms/1000:.1f}s removed)")
    print(f"    Speed-ups: {stats['speed_ups']} ({speedup_time_ms/1000:.1f}s → {speedup_time_ms/3000:.1f}s)")
    if fillers:
        print(f"    Filler words: {stats['filler_cuts']}")
    print(f"    Total saved: {total_saved_ms/1000:.1f}s ({stats['reduction_percent']}%)")
    print(f"    Estimated output: {estimated_output_ms/1000:.1f}s ({estimated_output_ms/60000:.1f} min)")

    result = {
        "edit_decisions": decisions,
        "segments": segments,
        "stats": stats,
        "metadata": {
            "source_file": video_path,
            "transcript_file": transcript_path,
            "detection_date": datetime.now().isoformat(),
            "noise_db": noise_db,
            "min_silence": min_silence,
        }
    }

    # Save output
    if output_path is None:
        project_name = Path(video_path).stem
        os.makedirs('.tmp', exist_ok=True)
        output_path = f".tmp/edit_decisions_{project_name}.json"

    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"\n  Saved: {output_path}")

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Detect edit points (silences, filler words) in video"
    )
    parser.add_argument(
        "video",
        help="Path to video file"
    )
    parser.add_argument(
        "--transcript", "-t",
        default=None,
        help="Path to transcript JSON for filler word detection"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output JSON path (default: .tmp/edit_decisions_{name}.json)"
    )
    parser.add_argument(
        "--silence-threshold",
        type=int,
        default=DEFAULT_NOISE_DB,
        help=f"Silence threshold in dB (default: {DEFAULT_NOISE_DB})"
    )
    parser.add_argument(
        "--min-silence",
        type=float,
        default=DEFAULT_MIN_SILENCE,
        help=f"Minimum silence duration in seconds (default: {DEFAULT_MIN_SILENCE})"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Detect Edits - WAT Framework")
    print("=" * 60)

    if not check_ffmpeg():
        print("Error: FFmpeg not installed. Run: brew install ffmpeg")
        sys.exit(1)

    detect_edits(
        video_path=args.video,
        transcript_path=args.transcript,
        output_path=args.output,
        noise_db=args.silence_threshold,
        min_silence=args.min_silence,
    )


if __name__ == "__main__":
    main()
