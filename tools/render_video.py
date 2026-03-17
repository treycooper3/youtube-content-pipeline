"""
Render Video - Remotion Overlay Renderer + FFmpeg Compositor

Renders motion graphics (intro, outro, lower thirds, captions) using Remotion,
then composites them onto the processed base video using FFmpeg.

Pipeline:
  1. Render intro as standalone clip via Remotion
  2. Render outro as standalone clip via Remotion
  3. Render lower thirds as transparent overlays (optional, captions handled inline)
  4. Concatenate: intro + processed video + outro
  5. If captions needed, render full video through LongFormTemplate composition

Usage:
    python render_video.py --edl .tmp/edl_my_video.json --processed .tmp/renders/my_video_processed.mp4
    python render_video.py --edl .tmp/edl_my_video.json --processed .tmp/renders/my_video_processed.mp4 --preview
    python render_video.py --edl .tmp/edl_my_video.json --processed .tmp/renders/my_video_processed.mp4 --quality high

Output:
    .tmp/renders/{project_name}_final.mp4

Requirements:
    - Node.js + Remotion project at Youtube_Videos/my-video/
    - FFmpeg installed

Author: WAT Framework
Last Updated: 2026-02-16
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Configuration
REMOTION_PROJECT_PATH = os.getenv(
    'REMOTION_PROJECT_PATH',
    os.path.join(os.path.dirname(__file__), '..', 'Youtube_Videos', 'my-video')
)

CIRCUIT_BREAKER = {
    "max_retries": 3,
    "timeout_seconds": 600,  # 10 minutes per render
}


def check_prerequisites():
    """Check that Remotion and FFmpeg are available."""
    errors = []

    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
    except FileNotFoundError:
        errors.append("FFmpeg not installed (brew install ffmpeg)")

    if not os.path.exists(REMOTION_PROJECT_PATH):
        errors.append(f"Remotion project not found: {REMOTION_PROJECT_PATH}")

    if errors:
        for e in errors:
            print(f"  Error: {e}")
        sys.exit(1)


def render_remotion_composition(
    composition_id: str,
    props: dict,
    output_path: str,
    duration_frames: int = None,
    width: int = 1920,
    height: int = 1080,
    quality: str = "high",
) -> bool:
    """
    Render a Remotion composition to a video file.

    Args:
        composition_id: Remotion composition ID (e.g., "StayStarvingIntro")
        props: Props dict for the composition
        output_path: Output file path
        duration_frames: Override duration in frames
        width: Output width
        height: Output height
        quality: "preview" (720p, fast) or "high" (full quality)
    """
    props_json = json.dumps(props)

    cmd = [
        'npx', 'remotion', 'render',
        composition_id,
        output_path,
        f'--props={props_json}',
        '--codec=h264',
    ]

    if duration_frames:
        cmd.append(f'--frames=0-{duration_frames - 1}')

    if quality == "preview":
        cmd.extend(['--scale=0.5', '--crf=28'])
    else:
        cmd.extend(['--crf=18'])

    original_dir = os.getcwd()
    try:
        os.chdir(REMOTION_PROJECT_PATH)
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=CIRCUIT_BREAKER["timeout_seconds"],
        )
        os.chdir(original_dir)

        if result.returncode == 0:
            return True
        else:
            print(f"  Remotion error: {result.stderr[-300:]}")
            return False

    except subprocess.TimeoutExpired:
        os.chdir(original_dir)
        print(f"  Remotion timeout: exceeded {CIRCUIT_BREAKER['timeout_seconds']}s")
        return False
    except Exception as e:
        os.chdir(original_dir)
        print(f"  Remotion error: {e}")
        return False


def render_intro(edl: dict, temp_dir: str, quality: str = "high") -> str:
    """Render the intro composition."""
    intro_config = edl.get("overlays", {}).get("intro")
    if not intro_config:
        return None

    fps = edl["project"]["fps"]
    duration_frames = int((intro_config["duration_ms"] / 1000) * fps)
    output_path = os.path.join(temp_dir, "intro.mp4")

    print(f"  Rendering intro ({intro_config['duration_ms']/1000:.1f}s)...")

    success = render_remotion_composition(
        composition_id=intro_config["composition"],
        props=intro_config["props"],
        output_path=output_path,
        duration_frames=duration_frames,
        quality=quality,
    )

    return output_path if success else None


def render_outro(edl: dict, temp_dir: str, quality: str = "high") -> str:
    """Render the outro composition."""
    outro_config = edl.get("overlays", {}).get("outro")
    if not outro_config:
        return None

    fps = edl["project"]["fps"]
    duration_frames = int((outro_config["duration_ms"] / 1000) * fps)
    output_path = os.path.join(temp_dir, "outro.mp4")

    print(f"  Rendering outro ({outro_config['duration_ms']/1000:.1f}s)...")

    success = render_remotion_composition(
        composition_id=outro_config["composition"],
        props=outro_config["props"],
        output_path=output_path,
        duration_frames=duration_frames,
        quality=quality,
    )

    return output_path if success else None


def concatenate_with_bookends(
    intro_path: str,
    main_path: str,
    outro_path: str,
    output_path: str,
    temp_dir: str,
) -> bool:
    """
    Concatenate intro + main video + outro using FFmpeg.

    Handles resolution/codec matching between clips.
    """
    clips = []
    if intro_path and os.path.exists(intro_path):
        clips.append(intro_path)
    clips.append(main_path)
    if outro_path and os.path.exists(outro_path):
        clips.append(outro_path)

    if len(clips) == 1:
        # No bookends, just copy the main video
        cmd = ['ffmpeg', '-i', main_path, '-c', 'copy', '-y', output_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0

    # Re-encode all clips to matching format for clean concatenation
    normalized_clips = []
    for i, clip in enumerate(clips):
        norm_path = os.path.join(temp_dir, f"norm_{i:02d}.mp4")
        cmd = [
            'ffmpeg', '-i', clip,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
            '-r', '30',
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
            '-y', norm_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            normalized_clips.append(norm_path)
        else:
            print(f"  Warning: Failed to normalize clip {i}")
            normalized_clips.append(clip)

    # Write concat list
    list_path = os.path.join(temp_dir, "final_concat.txt")
    with open(list_path, 'w') as f:
        for clip in normalized_clips:
            f.write(f"file '{clip}'\n")

    cmd = [
        'ffmpeg',
        '-f', 'concat', '-safe', '0',
        '-i', list_path,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        '-y', output_path,
    ]

    print(f"  Concatenating {len(normalized_clips)} clips (intro + main + outro)...")
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        timeout=CIRCUIT_BREAKER["timeout_seconds"],
    )
    return result.returncode == 0


def render_with_captions(
    edl: dict,
    processed_video: str,
    output_path: str,
    quality: str = "high",
) -> bool:
    """
    Render the full video through LongFormTemplate with captions overlaid.

    For videos under ~15 minutes, this renders the entire video through Remotion
    with captions. For longer videos, captions should be burned in via FFmpeg
    (not yet implemented, but the fallback is clean).
    """
    captions_config = edl.get("overlays", {}).get("captions", {})
    if not captions_config.get("enabled"):
        return False

    caption_pages = captions_config.get("pages", [])
    if not caption_pages:
        return False

    # Get video duration
    probe_cmd = [
        'ffprobe', '-v', 'quiet', '-print_format', 'json',
        '-show_format', processed_video
    ]
    result = subprocess.run(probe_cmd, capture_output=True, text=True)
    duration = float(json.loads(result.stdout)['format']['duration'])
    fps = edl["project"]["fps"]
    duration_frames = int(duration * fps)

    # For very long videos, skip Remotion caption rendering
    if duration > 900:  # 15 minutes
        print("  Video >15min: skipping Remotion caption render (use FFmpeg subtitles for long content)")
        return False

    print(f"  Rendering with captions via LongFormTemplate ({duration:.0f}s, {len(caption_pages)} pages)...")

    # Build lower thirds from EDL
    lower_thirds = []
    for lt in edl.get("overlays", {}).get("lower_thirds", []):
        lower_thirds.append({
            "startMs": lt["start_ms"],
            "durationMs": lt["duration_ms"],
            "props": lt["props"],
        })

    # Build text overlays from EDL
    text_overlays = []
    for to in edl.get("overlays", {}).get("text_overlays", []):
        text_overlays.append({
            "startMs": to["start_ms"],
            "durationMs": to["duration_ms"],
            "props": to["props"],
        })

    props = {
        "videoUrl": os.path.abspath(processed_video),
        "startFrom": 0,
        "captions": caption_pages,
        "showCaptions": True,
        "captionHighlightColor": captions_config.get("highlight_color", "#FFD700"),
        "captionPosition": captions_config.get("position", "bottom"),
        "lowerThirds": lower_thirds,
        "textOverlays": text_overlays,
        "showGradientOverlay": True,
        "useOffthreadVideo": True,
    }

    return render_remotion_composition(
        composition_id="LongFormVideo",
        props=props,
        output_path=output_path,
        duration_frames=duration_frames,
        quality=quality,
    )


def render_video(edl_path: str, processed_path: str, quality: str = "high") -> str:
    """
    Full rendering pipeline: Remotion overlays + FFmpeg compositing.

    Args:
        edl_path: Path to EDL JSON
        processed_path: Path to processed (cut/normalized) video
        quality: "preview" or "high"

    Returns:
        Path to final rendered video
    """
    with open(edl_path, 'r') as f:
        edl = json.load(f)

    project_name = edl["project"]["name"]
    os.makedirs('.tmp/renders', exist_ok=True)

    print(f"Rendering: {project_name}")
    print(f"  Quality: {quality}")
    print(f"  Processed video: {processed_path}")

    with tempfile.TemporaryDirectory() as temp_dir:
        # Step 1: Render intro and outro via Remotion
        intro_path = render_intro(edl, temp_dir, quality)
        outro_path = render_outro(edl, temp_dir, quality)

        # Step 2: Check if we need caption rendering
        captions_config = edl.get("overlays", {}).get("captions", {})
        has_captions = captions_config.get("enabled") and captions_config.get("pages")
        has_lower_thirds = bool(edl.get("overlays", {}).get("lower_thirds"))

        if has_captions or has_lower_thirds:
            # Step 3a: Render processed video through LongFormTemplate for captions + overlays
            captioned_path = os.path.join(temp_dir, "captioned.mp4")
            caption_success = render_with_captions(edl, processed_path, captioned_path, quality)

            if caption_success and os.path.exists(captioned_path):
                main_video = captioned_path
                print("  Captions and overlays rendered successfully")
            else:
                main_video = processed_path
                print("  Proceeding without Remotion captions")
        else:
            main_video = processed_path

        # Step 4: Concatenate intro + main + outro
        final_output = os.path.abspath(f".tmp/renders/{project_name}_final.mp4")

        success = concatenate_with_bookends(
            intro_path=intro_path,
            main_path=main_video,
            outro_path=outro_path,
            output_path=final_output,
            temp_dir=temp_dir,
        )

        if not success:
            print("Error: Final concatenation failed")
            sys.exit(1)

    # Print summary
    if os.path.exists(final_output):
        file_size_mb = os.path.getsize(final_output) / (1024 * 1024)
        probe_cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', final_output
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        duration = float(json.loads(result.stdout)['format']['duration'])

        print(f"\n  Final video: {final_output}")
        print(f"  Duration: {duration:.1f}s ({duration/60:.1f} min)")
        print(f"  Size: {file_size_mb:.1f} MB")
    else:
        print(f"Error: Final output not created at {final_output}")

    return final_output


def main():
    parser = argparse.ArgumentParser(
        description="Render Remotion overlays and composite final video"
    )
    parser.add_argument(
        "--edl",
        required=True,
        help="Path to EDL JSON"
    )
    parser.add_argument(
        "--processed",
        required=True,
        help="Path to processed (cut/normalized) video from process_video.py"
    )
    parser.add_argument(
        "--quality",
        choices=["preview", "high"],
        default="high",
        help="Render quality (default: high)"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Render Video - WAT Framework")
    print("=" * 60)

    check_prerequisites()

    render_video(
        edl_path=args.edl,
        processed_path=args.processed,
        quality=args.quality,
    )


if __name__ == "__main__":
    main()
