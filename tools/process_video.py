"""
Process Video - FFmpeg Video Processing Pipeline

Reads an EDL and executes the heavy video processing:
  - Extracts and concatenates timeline segments
  - Applies speed changes for sped-up sections
  - Normalizes audio to -14 LUFS (YouTube standard)
  - Mixes background music if specified

Output: A clean "assembled" video ready for Remotion overlay compositing.

Usage:
    python process_video.py --edl .tmp/edl_my_video.json
    python process_video.py --edl .tmp/edl_my_video.json --step cut
    python process_video.py --edl .tmp/edl_my_video.json --step audio
    python process_video.py --edl .tmp/edl_my_video.json --step all

Output:
    .tmp/processed_{project_name}.mp4

Requirements:
    - FFmpeg installed (brew install ffmpeg)

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

# Circuit breakers
CIRCUIT_BREAKER = {
    "max_retries": 3,
    "timeout_seconds": 1800,  # 30 minutes max for processing
}


def check_ffmpeg():
    """Verify FFmpeg is installed."""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False


def run_ffmpeg(cmd: list[str], description: str = "", timeout: int = None) -> bool:
    """Run an FFmpeg command with error handling."""
    if timeout is None:
        timeout = CIRCUIT_BREAKER["timeout_seconds"]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout
        )
        if result.returncode != 0:
            print(f"  FFmpeg error ({description}): {result.stderr[-500:]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"  FFmpeg timeout ({description}): exceeded {timeout}s")
        return False


def extract_segments(edl: dict, temp_dir: str) -> list[str]:
    """
    Extract each timeline segment as a separate clip.

    Returns list of clip file paths in order.
    """
    source_file = edl["project"]["source_file"]
    segments = edl["timeline"]["segments"]
    clip_paths = []

    print(f"\n  Extracting {len(segments)} segments...")

    for i, seg in enumerate(segments):
        start_s = seg["source_start_ms"] / 1000
        end_s = seg["source_end_ms"] / 1000
        duration_s = end_s - start_s
        speed = seg.get("speed", 1.0)

        clip_path = os.path.join(temp_dir, f"seg_{i:03d}.mp4")

        cmd = [
            'ffmpeg',
            '-ss', str(start_s),
            '-t', str(duration_s),
            '-i', source_file,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '18',
            '-c:a', 'aac',
            '-b:a', '192k',
        ]

        # Apply speed change if needed
        if speed != 1.0:
            # Video: setpts for speed, audio: atempo for speed
            video_filter = f"setpts={1/speed}*PTS"
            # atempo only supports 0.5-2.0, chain for higher speeds
            audio_filters = []
            remaining_speed = speed
            while remaining_speed > 2.0:
                audio_filters.append("atempo=2.0")
                remaining_speed /= 2.0
            audio_filters.append(f"atempo={remaining_speed}")
            audio_filter = ",".join(audio_filters)

            cmd.extend(['-vf', video_filter, '-af', audio_filter])

        cmd.extend(['-y', clip_path])

        success = run_ffmpeg(cmd, f"segment {i+1}/{len(segments)}")
        if success and os.path.exists(clip_path):
            clip_paths.append(clip_path)
            if speed != 1.0:
                print(f"    Segment {i+1}: {start_s:.1f}s-{end_s:.1f}s ({speed}x speed)")
            else:
                print(f"    Segment {i+1}: {start_s:.1f}s-{end_s:.1f}s")
        else:
            print(f"    Segment {i+1}: FAILED")

    return clip_paths


def concatenate_clips(clip_paths: list[str], output_path: str, temp_dir: str) -> bool:
    """
    Concatenate clips using FFmpeg concat demuxer.
    """
    if not clip_paths:
        print("  Error: No clips to concatenate")
        return False

    # Write concat list file
    list_path = os.path.join(temp_dir, "concat_list.txt")
    with open(list_path, 'w') as f:
        for clip in clip_paths:
            f.write(f"file '{clip}'\n")

    cmd = [
        'ffmpeg',
        '-f', 'concat',
        '-safe', '0',
        '-i', list_path,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-y', output_path,
    ]

    print(f"\n  Concatenating {len(clip_paths)} clips...")
    return run_ffmpeg(cmd, "concatenation")


def normalize_audio(input_path: str, output_path: str, target_lufs: int = -14) -> bool:
    """
    Normalize audio to target LUFS using FFmpeg loudnorm.

    Two-pass normalization for accurate results.
    """
    print(f"\n  Normalizing audio to {target_lufs} LUFS...")

    # Pass 1: Measure current loudness
    measure_cmd = [
        'ffmpeg', '-i', input_path,
        '-af', f'loudnorm=I={target_lufs}:TP=-1.5:LRA=11:print_format=json',
        '-f', 'null', '-'
    ]

    result = subprocess.run(measure_cmd, capture_output=True, text=True)

    # Parse loudnorm stats from stderr
    stderr = result.stderr
    json_start = stderr.rfind('{')
    json_end = stderr.rfind('}') + 1

    if json_start == -1 or json_end == 0:
        print("  Warning: Could not parse loudnorm stats, using single-pass")
        # Fallback to single-pass
        cmd = [
            'ffmpeg', '-i', input_path,
            '-af', f'loudnorm=I={target_lufs}:TP=-1.5:LRA=11',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k',
            '-y', output_path,
        ]
        return run_ffmpeg(cmd, "audio normalization (single-pass)")

    try:
        stats = json.loads(stderr[json_start:json_end])
    except json.JSONDecodeError:
        print("  Warning: Could not parse loudnorm JSON, using single-pass")
        cmd = [
            'ffmpeg', '-i', input_path,
            '-af', f'loudnorm=I={target_lufs}:TP=-1.5:LRA=11',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k',
            '-y', output_path,
        ]
        return run_ffmpeg(cmd, "audio normalization (single-pass)")

    # Pass 2: Apply measured normalization
    loudnorm_filter = (
        f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11:"
        f"measured_I={stats.get('input_i', '-24')}:"
        f"measured_TP={stats.get('input_tp', '-10')}:"
        f"measured_LRA={stats.get('input_lra', '7')}:"
        f"measured_thresh={stats.get('input_thresh', '-34')}:"
        f"offset={stats.get('target_offset', '0')}:"
        f"linear=true"
    )

    cmd = [
        'ffmpeg', '-i', input_path,
        '-af', loudnorm_filter,
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k',
        '-y', output_path,
    ]

    return run_ffmpeg(cmd, "audio normalization (two-pass)")


def mix_background_music(video_path: str, music_path: str, output_path: str,
                          volume: float = 0.15, fade_in_ms: int = 2000, fade_out_ms: int = 3000) -> bool:
    """
    Mix background music under the main audio.
    """
    if not os.path.exists(music_path):
        print(f"  Warning: Background music not found: {music_path}")
        return False

    print(f"\n  Mixing background music (volume: {volume})...")

    # Get video duration for fade out
    probe_cmd = [
        'ffprobe', '-v', 'quiet', '-print_format', 'json',
        '-show_format', video_path
    ]
    result = subprocess.run(probe_cmd, capture_output=True, text=True)
    duration = float(json.loads(result.stdout)['format']['duration'])

    fade_out_start = max(0, duration - fade_out_ms / 1000)

    # Build audio filter
    audio_filter = (
        f"[1:a]volume={volume},"
        f"afade=t=in:d={fade_in_ms/1000},"
        f"afade=t=out:st={fade_out_start}:d={fade_out_ms/1000}[music];"
        f"[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[out]"
    )

    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-i', music_path,
        '-filter_complex', audio_filter,
        '-map', '0:v',
        '-map', '[out]',
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest',
        '-y', output_path,
    ]

    return run_ffmpeg(cmd, "background music mixing")


def overlay_broll(input_path: str, output_path: str, edl: dict, temp_dir: str) -> bool:
    """
    Overlay B-roll clips onto the main video at specified timestamps.

    B-roll replaces the main video track while keeping the main audio.
    This creates the "cut to B-roll" effect common in YouTube videos.
    """
    broll_entries = edl.get("overlays", {}).get("b_roll", [])

    # Filter to only entries with downloaded local files
    valid_broll = [
        br for br in broll_entries
        if br.get("local_path") and os.path.exists(br["local_path"])
    ]

    if not valid_broll:
        return False

    print(f"\n  Splicing {len(valid_broll)} B-roll clips...")

    # Calculate the output timeline offset for B-roll timestamps
    # B-roll start_ms is relative to the original video, but our processed
    # video has cuts applied. We need to map original timestamps to processed timestamps.
    # For simplicity, use the output positions from segments to build a time map.
    segments = edl.get("timeline", {}).get("segments", [])

    def map_original_to_processed(original_ms: int) -> float:
        """Map a timestamp from the original video to the processed video timeline."""
        processed_offset = 0.0
        for seg in segments:
            seg_start = seg["source_start_ms"]
            seg_end = seg["source_end_ms"]
            speed = seg.get("speed", 1.0)
            seg_output_duration = (seg_end - seg_start) / speed

            if original_ms <= seg_start:
                return processed_offset
            elif original_ms < seg_end:
                # Within this segment
                into_segment = original_ms - seg_start
                return processed_offset + (into_segment / speed)
            else:
                processed_offset += seg_output_duration

        return processed_offset

    # Build FFmpeg filter complex for overlaying B-roll
    # Strategy: for each B-roll clip, use overlay filter with enable='between(t,start,end)'
    input_args = ['-i', input_path]
    for br in valid_broll:
        input_args.extend(['-i', br["local_path"]])

    # Build filter chain
    filter_parts = []
    current_stream = "0:v"

    for i, br in enumerate(valid_broll):
        start_s = map_original_to_processed(br["start_ms"]) / 1000
        duration_s = br.get("duration_ms", 4000) / 1000
        end_s = start_s + duration_s
        input_idx = i + 1

        # Scale B-roll to match main video and overlay
        out_label = f"v{i}"
        filter_parts.append(
            f"[{input_idx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
            f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[broll{i}];"
            f"[{current_stream}][broll{i}]overlay=0:0:enable='between(t,{start_s:.3f},{end_s:.3f})'[{out_label}]"
        )
        current_stream = out_label

        print(f"    B-roll {i+1}: \"{br.get('search_query', '')}\" at {start_s:.1f}s-{end_s:.1f}s")

    filter_complex = ";".join(filter_parts)

    cmd = ['ffmpeg'] + input_args + [
        '-filter_complex', filter_complex,
        '-map', f'[{current_stream}]',
        '-map', '0:a',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-c:a', 'copy',
        '-y', output_path,
    ]

    return run_ffmpeg(cmd, "B-roll overlay")


def process_video(edl_path: str, step: str = "all") -> str:
    """
    Full video processing pipeline driven by EDL.

    Args:
        edl_path: Path to EDL JSON
        step: "cut" (segments only), "audio" (normalize only), "all" (full pipeline)

    Returns:
        Path to processed output video
    """
    with open(edl_path, 'r') as f:
        edl = json.load(f)

    project_name = edl["project"]["name"]
    source_file = edl["project"]["source_file"]

    print(f"Processing: {project_name}")
    print(f"  Source: {os.path.basename(source_file)}")
    print(f"  Step: {step}")

    # Set up output paths
    os.makedirs('.tmp/renders', exist_ok=True)
    cut_output = os.path.abspath(f".tmp/renders/{project_name}_cut.mp4")
    normalized_output = os.path.abspath(f".tmp/renders/{project_name}_normalized.mp4")
    final_output = os.path.abspath(f".tmp/renders/{project_name}_processed.mp4")

    with tempfile.TemporaryDirectory() as temp_dir:
        if step in ("cut", "all"):
            # Step 1: Extract and concatenate segments
            clip_paths = extract_segments(edl, temp_dir)

            if not clip_paths:
                print("Error: No segments extracted")
                sys.exit(1)

            if not concatenate_clips(clip_paths, cut_output, temp_dir):
                print("Error: Concatenation failed")
                sys.exit(1)

            file_size_mb = os.path.getsize(cut_output) / (1024 * 1024)
            print(f"  Cut output: {cut_output} ({file_size_mb:.1f} MB)")

        if step == "cut":
            return cut_output

        if step in ("audio", "all"):
            # Step 2: Audio normalization
            input_for_audio = cut_output if step == "all" else source_file
            target_lufs = edl.get("audio", {}).get("target_lufs", -14)

            if not normalize_audio(input_for_audio, normalized_output, target_lufs):
                print("Warning: Audio normalization failed, using unnormalized")
                normalized_output = input_for_audio

            # Step 3: B-roll overlay (if available)
            broll_entries = edl.get("overlays", {}).get("b_roll", [])
            valid_broll = [br for br in broll_entries if br.get("local_path") and os.path.exists(br.get("local_path", ""))]

            if valid_broll:
                broll_output = os.path.abspath(f".tmp/renders/{project_name}_broll.mp4")
                if overlay_broll(normalized_output, broll_output, edl, temp_dir):
                    current_output = broll_output
                    print(f"  B-roll applied: {len(valid_broll)} clips")
                else:
                    current_output = normalized_output
                    print("  Warning: B-roll overlay failed, continuing without")
            else:
                current_output = normalized_output

            # Step 4: Background music (if specified)
            bg_music = edl.get("audio", {}).get("background_music")
            if bg_music and bg_music.get("file"):
                music_output = os.path.abspath(f".tmp/renders/{project_name}_music.mp4")
                if mix_background_music(
                    current_output, bg_music["file"], music_output,
                    volume=bg_music.get("volume", 0.15),
                    fade_in_ms=bg_music.get("fade_in_ms", 2000),
                    fade_out_ms=bg_music.get("fade_out_ms", 3000),
                ):
                    final_output = music_output
                else:
                    final_output = current_output
            else:
                final_output = current_output

        if step == "audio":
            return final_output

    # Rename to final output path
    expected_output = os.path.abspath(f".tmp/renders/{project_name}_processed.mp4")
    if final_output != expected_output and os.path.exists(final_output):
        os.rename(final_output, expected_output)
        final_output = expected_output

    print(f"\n  Final processed video: {final_output}")
    if os.path.exists(final_output):
        file_size_mb = os.path.getsize(final_output) / (1024 * 1024)
        print(f"  Size: {file_size_mb:.1f} MB")

    return final_output


def main():
    parser = argparse.ArgumentParser(
        description="Process video using FFmpeg (cut, normalize, mix) driven by EDL"
    )
    parser.add_argument(
        "--edl",
        required=True,
        help="Path to EDL JSON"
    )
    parser.add_argument(
        "--step",
        choices=["cut", "audio", "all"],
        default="all",
        help="Processing step (default: all)"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Process Video - WAT Framework")
    print("=" * 60)

    if not check_ffmpeg():
        print("Error: FFmpeg not installed. Run: brew install ffmpeg")
        sys.exit(1)

    process_video(edl_path=args.edl, step=args.step)


if __name__ == "__main__":
    main()
