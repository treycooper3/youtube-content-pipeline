"""
Fetch B-Roll - Pexels Stock Footage Downloader

Downloads stock video clips from Pexels based on B-roll suggestions
from enhance_edl.py. Clips are downloaded to .tmp/broll/ and their
local paths are written back into the EDL.

Usage:
    python fetch_broll.py --edl .tmp/edl_my_video.json
    python fetch_broll.py --edl .tmp/edl_my_video.json --resolution hd
    python fetch_broll.py --edl .tmp/edl_my_video.json --max-clips 5

Output:
    .tmp/broll/{project}_{index}_{query}.mp4
    Updates EDL b_roll entries with local file paths.

Requirements:
    - PEXELS_API_KEY in .env
    - requests package

Author: WAT Framework
Last Updated: 2026-02-16
"""

import os
import sys
import json
import argparse
import re
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
load_dotenv()

try:
    import requests
except ImportError:
    print("Error: requests package not installed. Run: pip3 install requests")
    sys.exit(1)

PEXELS_API_BASE = "https://api.pexels.com/videos/search"

CIRCUIT_BREAKER = {
    "max_retries": 2,
    "timeout_seconds": 30,
    "max_clips_per_video": 10,
}


def search_pexels_video(query: str, api_key: str, orientation: str = "landscape",
                         min_duration: int = 3, max_duration: int = 30) -> dict:
    """
    Search Pexels for a stock video matching the query.

    Returns the best matching video file info, or None.
    """
    headers = {"Authorization": api_key}
    params = {
        "query": query,
        "orientation": orientation,
        "per_page": 5,
        "size": "medium",
    }

    for attempt in range(CIRCUIT_BREAKER["max_retries"]):
        try:
            response = requests.get(
                PEXELS_API_BASE,
                headers=headers,
                params=params,
                timeout=CIRCUIT_BREAKER["timeout_seconds"],
            )

            if response.status_code == 200:
                data = response.json()
                videos = data.get("videos", [])

                # Filter by duration and pick best match
                for video in videos:
                    duration = video.get("duration", 0)
                    if min_duration <= duration <= max_duration:
                        # Get the HD or SD file
                        video_files = video.get("video_files", [])
                        # Prefer HD (1920x1080), fall back to smaller
                        best_file = None
                        for vf in sorted(video_files, key=lambda x: x.get("width", 0), reverse=True):
                            if vf.get("width", 0) >= 1280:
                                best_file = vf
                                break
                        if not best_file and video_files:
                            best_file = video_files[0]

                        if best_file:
                            return {
                                "id": video["id"],
                                "url": best_file["link"],
                                "width": best_file.get("width", 0),
                                "height": best_file.get("height", 0),
                                "duration": duration,
                                "photographer": video.get("user", {}).get("name", "Unknown"),
                            }

                return None

            elif response.status_code == 429:
                print(f"    Pexels rate limited, retrying...")
                import time
                time.sleep(2)
            else:
                print(f"    Pexels API error {response.status_code}: {response.text[:200]}")
                return None

        except requests.exceptions.Timeout:
            print(f"    Pexels timeout (attempt {attempt+1})")
        except Exception as e:
            print(f"    Pexels error: {e}")

    return None


def download_video(url: str, output_path: str) -> bool:
    """Download a video file from URL."""
    try:
        response = requests.get(url, stream=True, timeout=60)
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return os.path.exists(output_path) and os.path.getsize(output_path) > 0
        return False
    except Exception as e:
        print(f"    Download error: {e}")
        return False


def trim_broll_clip(input_path: str, output_path: str, target_duration_ms: int) -> bool:
    """
    Trim a B-roll clip to the target duration.
    Also ensures it matches the main video format (1920x1080, 30fps).
    """
    target_seconds = target_duration_ms / 1000

    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-t', str(target_seconds),
        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-an',  # Remove audio from B-roll
        '-y', output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    return result.returncode == 0


def sanitize_filename(query: str) -> str:
    """Convert search query to safe filename."""
    return re.sub(r'[^a-zA-Z0-9_]', '_', query.lower().strip())[:30]


def fetch_broll(edl_path: str, max_clips: int = None) -> list[str]:
    """
    Fetch all B-roll clips specified in the EDL.

    Returns list of downloaded clip paths.
    """
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key:
        print("Error: PEXELS_API_KEY not found in .env")
        sys.exit(1)

    with open(edl_path, 'r') as f:
        edl = json.load(f)

    project_name = edl["project"]["name"]
    broll_suggestions = edl.get("overlays", {}).get("b_roll", [])

    if not broll_suggestions:
        print("  No B-roll suggestions in EDL (run enhance_edl.py first)")
        return []

    if max_clips is None:
        max_clips = CIRCUIT_BREAKER["max_clips_per_video"]
    broll_suggestions = broll_suggestions[:max_clips]

    print(f"Fetching B-roll for: {project_name}")
    print(f"  Clips to fetch: {len(broll_suggestions)}")

    # Set up output directory
    broll_dir = os.path.abspath(f".tmp/broll/{project_name}")
    os.makedirs(broll_dir, exist_ok=True)

    downloaded_paths = []
    credits = []  # Track Pexels attribution

    for i, suggestion in enumerate(broll_suggestions):
        query = suggestion.get("search_query", "")
        duration_ms = suggestion.get("duration_ms", 4000)
        reason = suggestion.get("reason", "")

        print(f"\n  [{i+1}/{len(broll_suggestions)}] Searching: \"{query}\"")
        if reason:
            print(f"    Reason: {reason}")

        # Search Pexels
        result = search_pexels_video(query, api_key)

        if not result:
            print(f"    No matching video found, trying simpler query...")
            # Try a simpler version of the query (first 2 words)
            simple_query = " ".join(query.split()[:2])
            result = search_pexels_video(simple_query, api_key)

        if not result:
            print(f"    Skipped: no suitable stock footage found")
            suggestion["local_path"] = None
            continue

        # Download the raw clip
        safe_name = sanitize_filename(query)
        raw_path = os.path.join(broll_dir, f"raw_{i:02d}_{safe_name}.mp4")
        final_path = os.path.join(broll_dir, f"broll_{i:02d}_{safe_name}.mp4")

        print(f"    Downloading: {result['width']}x{result['height']}, {result['duration']}s")
        if not download_video(result["url"], raw_path):
            print(f"    Download failed")
            suggestion["local_path"] = None
            continue

        # Trim and normalize to match main video
        print(f"    Trimming to {duration_ms/1000:.1f}s and normalizing...")
        if trim_broll_clip(raw_path, final_path, duration_ms):
            downloaded_paths.append(final_path)
            suggestion["local_path"] = final_path
            suggestion["pexels_id"] = result["id"]
            suggestion["photographer"] = result["photographer"]
            credits.append(f"B-roll: \"{query}\" by {result['photographer']} (Pexels)")

            # Clean up raw file
            if os.path.exists(raw_path):
                os.remove(raw_path)

            file_size_kb = os.path.getsize(final_path) / 1024
            print(f"    Saved: {final_path} ({file_size_kb:.0f} KB)")
        else:
            print(f"    Trim/normalize failed")
            suggestion["local_path"] = None

    # Update EDL with local paths
    edl["overlays"]["b_roll"] = broll_suggestions
    if credits:
        edl["credits"] = edl.get("credits", []) + credits

    with open(edl_path, 'w') as f:
        json.dump(edl, f, indent=2)

    print(f"\n  Downloaded: {len(downloaded_paths)}/{len(broll_suggestions)} clips")
    print(f"  Updated EDL: {edl_path}")

    if credits:
        print(f"\n  Attribution (add to video description):")
        for credit in credits:
            print(f"    {credit}")

    return downloaded_paths


def main():
    parser = argparse.ArgumentParser(
        description="Fetch B-roll stock footage from Pexels based on EDL suggestions"
    )
    parser.add_argument(
        "--edl",
        required=True,
        help="Path to EDL JSON (must have b_roll suggestions from enhance_edl.py)"
    )
    parser.add_argument(
        "--max-clips",
        type=int,
        default=None,
        help=f"Maximum clips to download (default: {CIRCUIT_BREAKER['max_clips_per_video']})"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Fetch B-Roll - WAT Framework (Pexels Stock Footage)")
    print("=" * 60)

    fetch_broll(
        edl_path=args.edl,
        max_clips=args.max_clips,
    )


if __name__ == "__main__":
    main()
