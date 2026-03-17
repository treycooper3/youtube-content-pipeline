"""
Render Short - Remotion CLI Wrapper

Renders YouTube Shorts from viral moments JSON using Remotion.
Takes the output from extract_viral_moments.py and produces MP4 files.

Usage:
    python render_short.py --moments .tmp/viral_moments_2026-01-29.json
    python render_short.py --moments .tmp/viral_moments_2026-01-29.json --index 0
    python render_short.py --single --props '{"clipUrl": "...", ...}'

Requirements:
    - Node.js installed
    - Remotion project at Youtube_Videos/my-video/
    - npx available in PATH

Output:
    - .tmp/shorts/*.mp4

Author: WAT Framework
Last Updated: 2026-01-29
"""

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
REMOTION_PROJECT_PATH = os.getenv(
    'REMOTION_PROJECT_PATH',
    os.path.join(os.path.dirname(__file__), '..', 'Youtube_Videos', 'my-video')
)
OUTPUT_DIR = os.getenv('SHORTS_OUTPUT_DIR', '.tmp/shorts')
COMPOSITION_ID = 'ShortsTemplate'
DEFAULT_FPS = 30
DEFAULT_CODEC = 'h264'  # Options: h264, h265, vp8, vp9, prores

# Circuit breakers
CIRCUIT_BREAKER = {
    "max_retries": 3,
    "timeout_seconds": 600,  # 10 minutes per render
    "max_parallel_renders": 3,
    "alert_on_failure": True,
}


def ensure_output_dir():
    """Create output directory if it doesn't exist."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def build_remotion_command(
    props: dict,
    output_path: str,
    duration_frames: Optional[int] = None,
    codec: str = DEFAULT_CODEC,
) -> list[str]:
    """
    Build the npx remotion render command.

    Args:
        props: Dictionary of props for the composition
        output_path: Path for the output MP4 file
        duration_frames: Optional duration override in frames
        codec: Video codec to use

    Returns:
        List of command arguments
    """
    # Convert props to JSON string
    props_json = json.dumps(props)

    cmd = [
        'npx',
        'remotion',
        'render',
        COMPOSITION_ID,
        output_path,
        f'--props={props_json}',
        f'--codec={codec}',
    ]

    # Add duration if specified (--frames requires a range like 0-750)
    if duration_frames:
        cmd.append(f'--frames=0-{int(duration_frames)}')

    return cmd


def render_single(
    props: dict,
    output_name: str,
    duration_seconds: Optional[int] = None,
) -> Optional[str]:
    """
    Render a single Short using Remotion CLI.

    Args:
        props: Dictionary of props for ShortsTemplate
        output_name: Name for the output file (without extension)
        duration_seconds: Optional duration in seconds

    Returns:
        Path to rendered file, or None if failed
    """
    ensure_output_dir()

    # Calculate frames if duration specified
    duration_frames = None
    if duration_seconds:
        duration_frames = duration_seconds * DEFAULT_FPS

    # Build output path
    output_path = os.path.join(OUTPUT_DIR, f"{output_name}.mp4")

    # Build command
    cmd = build_remotion_command(
        props=props,
        output_path=output_path,
        duration_frames=duration_frames,
    )

    print(f"Rendering: {output_name}")
    print(f"  Output: {output_path}")
    print(f"  Props: {json.dumps(props, indent=2)[:200]}...")

    # Change to Remotion project directory
    original_dir = os.getcwd()

    try:
        os.chdir(REMOTION_PROJECT_PATH)

        # Run the render command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=CIRCUIT_BREAKER["timeout_seconds"],
        )

        os.chdir(original_dir)

        if result.returncode == 0:
            print(f"  Success: {output_path}")
            return output_path
        else:
            print(f"  Error: {result.stderr}")
            return None

    except subprocess.TimeoutExpired:
        os.chdir(original_dir)
        print(f"  Error: Render timed out after {CIRCUIT_BREAKER['timeout_seconds']}s")
        return None
    except Exception as e:
        os.chdir(original_dir)
        print(f"  Error: {e}")
        return None


def render_from_moment(
    moment: dict,
    video_url: str,
    index: int,
) -> Optional[str]:
    """
    Render a Short from a viral moment.

    Args:
        moment: Moment dictionary from extract_viral_moments.py output
        video_url: URL or path to the source video
        index: Index for naming the output file

    Returns:
        Path to rendered file, or None if failed
    """
    # Parse timestamps
    start_time = moment.get('start_time', '0:00')
    duration_seconds = moment.get('duration_seconds', 30)

    # Convert MM:SS to seconds
    parts = start_time.split(':')
    if len(parts) == 2:
        start_seconds = int(parts[0]) * 60 + int(parts[1])
    elif len(parts) == 3:
        start_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    else:
        start_seconds = 0

    # Build props for ShortsTemplate
    props = {
        "clipUrl": video_url,
        "startFrom": start_seconds,
        "captions": [],  # Populate via: python tools/generate_captions.py --transcript .tmp/transcript_{video}.json
        "showCaptions": True,
        "showSubscribeCTA": True,
        "ctaDelaySeconds": 0,  # Show at end
        "ctaDurationSeconds": 3,
        "channelName": "Stay Starving",
        "showWatermark": False,
        "backgroundColor": "#000000",
        "useOffthreadVideo": False,  # Set to False for local file paths; Offthread requires HTTP(S) URLs
    }

    # Generate output name from title
    title = moment.get('suggested_title', f'moment_{index}')
    safe_title = "".join(c if c.isalnum() or c in ' -_' else '' for c in title)
    safe_title = safe_title.replace(' ', '_')[:50]
    output_name = f"{index:02d}_{safe_title}"

    return render_single(
        props=props,
        output_name=output_name,
        duration_seconds=duration_seconds,
    )


def batch_render_from_moments(
    moments_file: str,
    video_url: str,
    indices: Optional[list[int]] = None,
) -> list[str]:
    """
    Batch render Shorts from a viral moments JSON file.

    Args:
        moments_file: Path to viral moments JSON file
        video_url: URL or path to the source video
        indices: Optional list of moment indices to render (renders all if None)

    Returns:
        List of paths to successfully rendered files
    """
    # Load moments file
    with open(moments_file, 'r') as f:
        data = json.load(f)

    moments = data.get('moments', [])

    if not moments:
        print("No moments found in file")
        return []

    # Filter by indices if specified
    if indices:
        moments_to_render = [(i, m) for i, m in enumerate(moments) if i in indices]
    else:
        moments_to_render = list(enumerate(moments))

    print(f"Rendering {len(moments_to_render)} Shorts from {len(moments)} moments")
    print(f"Source video: {video_url}")
    print()

    # Render each moment
    rendered_files = []
    for index, moment in moments_to_render:
        result = render_from_moment(
            moment=moment,
            video_url=video_url,
            index=index,
        )
        if result:
            rendered_files.append(result)
        print()

    return rendered_files


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description="Render YouTube Shorts using Remotion"
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Batch render from moments file
    batch_parser = subparsers.add_parser("batch", help="Batch render from moments file")
    batch_parser.add_argument(
        "--moments",
        required=True,
        help="Path to viral moments JSON file"
    )
    batch_parser.add_argument(
        "--video",
        required=True,
        help="URL or path to source video"
    )
    batch_parser.add_argument(
        "--indices",
        type=str,
        default=None,
        help="Comma-separated list of moment indices to render (e.g., '0,1,2')"
    )

    # Single render with custom props
    single_parser = subparsers.add_parser("single", help="Render single Short with custom props")
    single_parser.add_argument(
        "--props",
        required=True,
        help="JSON string of props for ShortsTemplate"
    )
    single_parser.add_argument(
        "--output",
        default="custom_short",
        help="Output filename (without extension)"
    )
    single_parser.add_argument(
        "--duration",
        type=int,
        default=None,
        help="Duration in seconds"
    )

    # Check command - verify Remotion setup
    check_parser = subparsers.add_parser("check", help="Check Remotion installation")

    args = parser.parse_args()

    print("=" * 60)
    print("Render Short - WAT Framework")
    print("=" * 60)
    print()

    if args.command == "check":
        # Verify Remotion is installed and project exists
        print(f"Remotion project path: {REMOTION_PROJECT_PATH}")
        print(f"Project exists: {os.path.exists(REMOTION_PROJECT_PATH)}")

        # Check for package.json
        pkg_path = os.path.join(REMOTION_PROJECT_PATH, "package.json")
        print(f"package.json exists: {os.path.exists(pkg_path)}")

        # Try running npx remotion --version
        try:
            result = subprocess.run(
                ["npx", "remotion", "--version"],
                capture_output=True,
                text=True,
                cwd=REMOTION_PROJECT_PATH,
            )
            print(f"Remotion version: {result.stdout.strip()}")
        except Exception as e:
            print(f"Error checking Remotion: {e}")

        return

    elif args.command == "batch":
        # Parse indices if provided
        indices = None
        if args.indices:
            indices = [int(i.strip()) for i in args.indices.split(",")]

        rendered = batch_render_from_moments(
            moments_file=args.moments,
            video_url=args.video,
            indices=indices,
        )

        print("=" * 60)
        print("Batch Render Complete")
        print("=" * 60)
        print(f"Successfully rendered: {len(rendered)} files")
        for f in rendered:
            print(f"  - {f}")

    elif args.command == "single":
        # Parse props JSON
        try:
            props = json.loads(args.props)
        except json.JSONDecodeError as e:
            print(f"Error parsing props JSON: {e}")
            sys.exit(1)

        result = render_single(
            props=props,
            output_name=args.output,
            duration_seconds=args.duration,
        )

        if result:
            print(f"\nSuccess: {result}")
        else:
            print("\nRender failed")
            sys.exit(1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
