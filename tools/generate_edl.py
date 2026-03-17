"""
Generate EDL - Edit Decision List Builder

Combines transcript, edit decisions, and brand config into a complete
EDL (Edit Decision List) JSON that drives the entire rendering pipeline.

The EDL is the central data structure — every downstream tool reads it.

Usage:
    python generate_edl.py --source input.mp4 --transcript .tmp/transcript.json --edits .tmp/edit_decisions.json --title "My Video"
    python generate_edl.py --source input.mp4 --transcript .tmp/transcript.json --format short
    python generate_edl.py --source input.mp4 --title "My Video" --no-edits

Output:
    .tmp/edl_{project_name}.json

Author: WAT Framework
Last Updated: 2026-02-16
"""

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Paths
BRAND_CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config', 'brand.json')


def load_brand_config() -> dict:
    """Load brand configuration."""
    if os.path.exists(BRAND_CONFIG_PATH):
        with open(BRAND_CONFIG_PATH, 'r') as f:
            return json.load(f)
    print("Warning: brand.json not found, using defaults")
    return {
        "channel_name": "Stay Starving",
        "colors": {"primary": "#FFD700", "secondary": "#1a1a2e", "text_primary": "#FFFFFF", "accent": "#FF6B35"},
        "fonts": {"heading": "Inter", "body": "Inter"},
        "captions": {"highlight_color": "#FFD700", "position": "bottom"},
        "lower_third": {"default_name": "Trey Cooper", "default_title": "Founder, Stay Starving"},
    }


def get_video_info(video_path: str) -> dict:
    """Get video metadata using ffprobe."""
    cmd = [
        'ffprobe', '-v', 'quiet',
        '-print_format', 'json',
        '-show_format', '-show_streams',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return {"duration": 0, "width": 1920, "height": 1080, "fps": 30}

    data = json.loads(result.stdout)
    fmt = data.get('format', {})
    video_stream = next(
        (s for s in data.get('streams', []) if s.get('codec_type') == 'video'),
        {}
    )

    # Parse fps from r_frame_rate (e.g., "30/1" or "30000/1001")
    fps_str = video_stream.get('r_frame_rate', '30/1')
    if '/' in fps_str:
        num, den = fps_str.split('/')
        fps = round(int(num) / int(den))
    else:
        fps = int(fps_str)

    return {
        "duration": float(fmt.get('duration', 0)),
        "width": int(video_stream.get('width', 1920)),
        "height": int(video_stream.get('height', 1080)),
        "fps": fps,
    }


def build_segments_from_edits(edit_decisions: dict, total_duration_ms: int) -> list[dict]:
    """
    Build timeline segments from edit decisions.

    Takes the 'segments' from detect_edits.py output and converts them
    into EDL timeline segment format.
    """
    segments = []
    output_position_ms = 0

    for seg in edit_decisions.get("segments", []):
        if seg["type"] == "keep":
            segments.append({
                "id": f"seg_{len(segments):03d}",
                "type": "talking_head",
                "source": "raw",
                "source_start_ms": seg["start_ms"],
                "source_end_ms": seg["end_ms"],
                "output_start_ms": output_position_ms,
                "speed": 1.0,
                "audio": True,
                "transitions": {
                    "in": {"type": "cut"},
                    "out": {"type": "cut"},
                },
            })
            output_position_ms += seg["end_ms"] - seg["start_ms"]

        elif seg["type"] == "speed_up":
            speed = seg.get("speed", 3.0)
            duration = seg["end_ms"] - seg["start_ms"]
            output_duration = int(duration / speed)

            segments.append({
                "id": f"seg_{len(segments):03d}",
                "type": "talking_head",
                "source": "raw",
                "source_start_ms": seg["start_ms"],
                "source_end_ms": seg["end_ms"],
                "output_start_ms": output_position_ms,
                "speed": speed,
                "audio": True,
                "transitions": {
                    "in": {"type": "cut"},
                    "out": {"type": "cut"},
                },
            })
            output_position_ms += output_duration

    return segments


def build_segments_no_edits(total_duration_ms: int) -> list[dict]:
    """Build a single segment covering the full video (no editing)."""
    return [{
        "id": "seg_000",
        "type": "talking_head",
        "source": "raw",
        "source_start_ms": 0,
        "source_end_ms": total_duration_ms,
        "output_start_ms": 0,
        "speed": 1.0,
        "audio": True,
        "transitions": {
            "in": {"type": "cut"},
            "out": {"type": "cut"},
        },
    }]


def build_caption_pages(words: list[dict], words_per_page: int = 6, combine_within_ms: int = 1200) -> list[dict]:
    """
    Generate caption pages from transcript words.
    Mirrors createCaptionPages() from CaptionOverlay.tsx.
    """
    if not words:
        return []

    pages = []
    current_page = []
    page_start_ms = words[0]["startMs"]

    for word in words:
        should_start_new = (
            len(current_page) >= words_per_page or
            (len(current_page) > 0 and
             word["startMs"] - current_page[-1]["endMs"] > combine_within_ms)
        )

        if should_start_new and current_page:
            pages.append({
                "tokens": [{"text": w["text"], "startMs": w["startMs"], "endMs": w["endMs"]} for w in current_page],
                "startMs": page_start_ms,
                "endMs": current_page[-1]["endMs"],
            })
            current_page = []
            page_start_ms = word["startMs"]

        current_page.append(word)

    if current_page:
        pages.append({
            "tokens": [{"text": w["text"], "startMs": w["startMs"], "endMs": w["endMs"]} for w in current_page],
            "startMs": page_start_ms,
            "endMs": current_page[-1]["endMs"],
        })

    return pages


def generate_edl(
    source_path: str,
    transcript_path: str = None,
    edits_path: str = None,
    title: str = "",
    video_format: str = "long-form",
    output_path: str = None,
    include_intro: bool = True,
    include_outro: bool = True,
    include_lower_third: bool = True,
    include_captions: bool = True,
) -> dict:
    """
    Generate a complete EDL from all inputs.

    Args:
        source_path: Path to raw video file
        transcript_path: Path to transcript JSON
        edits_path: Path to edit decisions JSON
        title: Video title
        video_format: "long-form", "short", or "screen-recording"
        output_path: Output EDL JSON path
        include_intro: Add intro overlay
        include_outro: Add outro overlay
        include_lower_third: Add lower third at start
        include_captions: Generate captions from transcript
    """
    source_path = os.path.abspath(source_path)

    if not os.path.exists(source_path):
        print(f"Error: Source file not found: {source_path}")
        sys.exit(1)

    # Load inputs
    brand = load_brand_config()
    video_info = get_video_info(source_path)
    total_duration_ms = int(video_info["duration"] * 1000)

    print(f"Generating EDL for: {title or os.path.basename(source_path)}")
    print(f"  Format: {video_format}")
    print(f"  Duration: {video_info['duration']:.1f}s")
    print(f"  Resolution: {video_info['width']}x{video_info['height']} @ {video_info['fps']}fps")

    # Load transcript
    transcript_words = []
    full_text = ""
    if transcript_path and os.path.exists(transcript_path):
        with open(transcript_path, 'r') as f:
            transcript = json.load(f)
        transcript_words = transcript.get("words", [])
        full_text = transcript.get("full_text", "")
        print(f"  Transcript: {len(transcript_words)} words")

    # Load edit decisions
    edit_decisions = None
    if edits_path and os.path.exists(edits_path):
        with open(edits_path, 'r') as f:
            edit_decisions = json.load(f)
        print(f"  Edit decisions: {edit_decisions['stats']['cuts']} cuts, {edit_decisions['stats']['speed_ups']} speed-ups")

    # Build timeline segments
    if edit_decisions:
        segments = build_segments_from_edits(edit_decisions, total_duration_ms)
        silence_removed = edit_decisions.get("edit_decisions", [])
    else:
        segments = build_segments_no_edits(total_duration_ms)
        silence_removed = []

    # Calculate estimated output duration
    output_duration_ms = sum(
        int((seg["source_end_ms"] - seg["source_start_ms"]) / seg["speed"])
        for seg in segments
    )

    # Build overlays
    overlays = {}

    # Intro
    intro_duration_ms = int(brand.get("intro", {}).get("duration_seconds", 4) * 1000)
    if include_intro:
        overlays["intro"] = {
            "composition": brand.get("intro", {}).get("composition", "StayStarvingIntro"),
            "duration_ms": intro_duration_ms,
            "position": "start",
            "props": {
                "title": title,
                "logoUrl": "",
                "primaryColor": brand["colors"]["primary"],
                "secondaryColor": brand["colors"]["secondary"],
                "textColor": brand["colors"]["text_primary"],
            },
        }

    # Outro
    outro_duration_ms = int(brand.get("outro", {}).get("duration_seconds", 6) * 1000)
    if include_outro:
        overlays["outro"] = {
            "composition": brand.get("outro", {}).get("composition", "StayStarvingOutro"),
            "duration_ms": outro_duration_ms,
            "position": "end",
            "props": {
                "channelName": brand.get("channel_name", "Stay Starving"),
                "logoUrl": "",
                "primaryColor": brand["colors"]["primary"],
                "secondaryColor": brand["colors"]["secondary"],
                "subscribeColor": brand["colors"]["accent"],
            },
        }

    # Lower third (appears ~5 seconds into the main content)
    lt_config = brand.get("lower_third", {})
    if include_lower_third:
        overlays["lower_thirds"] = [{
            "composition": "LowerThird",
            "start_ms": 5000,
            "duration_ms": int(lt_config.get("duration_seconds", 4) * 1000),
            "props": {
                "name": lt_config.get("default_name", "Trey Cooper"),
                "title": lt_config.get("default_title", "Founder, Stay Starving"),
                "accentColor": lt_config.get("accent_color", brand["colors"]["primary"]),
            },
        }]
    else:
        overlays["lower_thirds"] = []

    # Captions
    caption_config = brand.get("captions", {})
    caption_pages = []
    if include_captions and transcript_words:
        caption_pages = build_caption_pages(
            transcript_words,
            caption_config.get("words_per_page", 6),
            caption_config.get("combine_within_ms", 1200),
        )
        print(f"  Caption pages: {len(caption_pages)}")

    overlays["captions"] = {
        "enabled": include_captions and len(caption_pages) > 0,
        "style": "tiktok",
        "highlight_color": caption_config.get("highlight_color", "#FFD700"),
        "position": caption_config.get("position", "bottom"),
        "pages": caption_pages,
    }

    overlays["text_overlays"] = []
    overlays["screen_zooms"] = []

    # Build complete EDL
    project_name = Path(source_path).stem.lower().replace(" ", "_")

    edl = {
        "version": "1.0",
        "project": {
            "name": project_name,
            "title": title,
            "created": datetime.now().isoformat(),
            "format": video_format,
            "source_file": source_path,
            "source_duration_seconds": video_info["duration"],
            "output_resolution": {
                "width": video_info["width"],
                "height": video_info["height"],
            },
            "fps": video_info["fps"],
        },
        "brand": {
            "channel_name": brand.get("channel_name", "Stay Starving"),
            "logo_path": brand.get("logo_path", ""),
            "primary_color": brand["colors"]["primary"],
            "secondary_color": brand["colors"]["secondary"],
            "font_family": brand["fonts"]["heading"],
        },
        "transcript": {
            "file": transcript_path or "",
            "words": transcript_words,
            "full_text": full_text,
        },
        "timeline": {
            "segments": segments,
            "silence_removed": silence_removed,
            "estimated_output_duration_ms": output_duration_ms,
        },
        "overlays": overlays,
        "audio": {
            "normalize": True,
            "target_lufs": -14,
            "background_music": None,
        },
        "render": {
            "codec": "h264",
            "quality": "high",
            "output_path": f".tmp/renders/{project_name}_final.mp4",
        },
        "upload": {
            "title": title,
            "description": "",
            "tags": [],
            "category": "22",
            "privacy": "private",
            "scheduled_publish": None,
        },
    }

    # Print summary
    total_with_overlays = output_duration_ms
    if include_intro:
        total_with_overlays += intro_duration_ms
    if include_outro:
        total_with_overlays += outro_duration_ms

    print(f"\n  EDL Summary:")
    print(f"    Segments: {len(segments)}")
    print(f"    Main content: {output_duration_ms/1000:.1f}s")
    if include_intro:
        print(f"    + Intro: {intro_duration_ms/1000:.1f}s")
    if include_outro:
        print(f"    + Outro: {outro_duration_ms/1000:.1f}s")
    print(f"    Estimated final: {total_with_overlays/1000:.1f}s ({total_with_overlays/60000:.1f} min)")
    if edit_decisions:
        reduction = edit_decisions["stats"]["reduction_percent"]
        print(f"    Time saved from edits: {reduction}%")

    # Save output
    if output_path is None:
        os.makedirs('.tmp', exist_ok=True)
        output_path = f".tmp/edl_{project_name}.json"

    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(edl, f, indent=2)

    print(f"\n  Saved: {output_path}")

    return edl


def main():
    parser = argparse.ArgumentParser(
        description="Generate EDL (Edit Decision List) from transcript and edit decisions"
    )
    parser.add_argument(
        "--source", "-s",
        required=True,
        help="Path to raw video file"
    )
    parser.add_argument(
        "--transcript", "-t",
        default=None,
        help="Path to transcript JSON from transcribe_video.py"
    )
    parser.add_argument(
        "--edits", "-e",
        default=None,
        help="Path to edit decisions JSON from detect_edits.py"
    )
    parser.add_argument(
        "--title",
        default="",
        help="Video title"
    )
    parser.add_argument(
        "--format",
        choices=["long-form", "short", "screen-recording"],
        default="long-form",
        help="Video format (default: long-form)"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output EDL JSON path"
    )
    parser.add_argument(
        "--no-intro",
        action="store_true",
        help="Skip intro overlay"
    )
    parser.add_argument(
        "--no-outro",
        action="store_true",
        help="Skip outro overlay"
    )
    parser.add_argument(
        "--no-lower-third",
        action="store_true",
        help="Skip lower third overlay"
    )
    parser.add_argument(
        "--no-captions",
        action="store_true",
        help="Skip caption generation"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Generate EDL - WAT Framework")
    print("=" * 60)

    generate_edl(
        source_path=args.source,
        transcript_path=args.transcript,
        edits_path=args.edits,
        title=args.title,
        video_format=args.format,
        output_path=args.output,
        include_intro=not args.no_intro,
        include_outro=not args.no_outro,
        include_lower_third=not args.no_lower_third,
        include_captions=not args.no_captions,
    )


if __name__ == "__main__":
    main()
