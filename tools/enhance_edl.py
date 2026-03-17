"""
Enhance EDL - Claude-Powered Intelligence Layer

Analyzes the transcript and EDL using Claude to make creative editing decisions:
  - Where to insert B-roll (with Pexels search terms)
  - Where to place text overlays (key points, stats, emphasis)
  - Lower third timing adjustments
  - Topic segmentation for natural scene breaks

This bridges the gap between "automated cuts" and "professionally edited video."

Usage:
    python enhance_edl.py --edl .tmp/edl_my_video.json
    python enhance_edl.py --edl .tmp/edl_my_video.json --no-broll
    python enhance_edl.py --edl .tmp/edl_my_video.json --style energetic

Output:
    Updates the EDL in-place with enhanced overlays and b-roll placements.
    Also saves .tmp/broll_suggestions_{name}.json for fetch_broll.py.

Requirements:
    - ANTHROPIC_API_KEY in .env

Author: WAT Framework
Last Updated: 2026-02-16
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

try:
    import anthropic
except ImportError:
    print("Error: anthropic package not installed. Run: pip3 install anthropic")
    sys.exit(1)

CIRCUIT_BREAKER = {
    "max_retries": 2,
    "max_tokens": 4096,
}

ENHANCEMENT_PROMPT = """You are a professional YouTube video editor analyzing a transcript to make creative editing decisions.

VIDEO TITLE: {title}
VIDEO DURATION: {duration_seconds:.1f} seconds
TRANSCRIPT:
{transcript}

EXISTING OVERLAYS:
- Lower thirds: {lower_third_count}
- Text overlays: {text_overlay_count}

EDITING STYLE: {style}

Analyze this transcript and return a JSON object with these creative decisions:

1. **b_roll_suggestions**: Array of moments where stock B-roll footage would enhance the video. For each:
   - `start_ms`: When to start the B-roll (in milliseconds from video start)
   - `duration_ms`: How long to show it (typically 3000-5000ms)
   - `search_query`: A specific Pexels search term (2-4 words, visually concrete)
   - `reason`: Brief explanation of why B-roll fits here

   Guidelines:
   - Insert B-roll when the speaker references something visual (places, objects, actions)
   - Use B-roll during topic transitions to create visual breaks
   - Don't overdo it — aim for 1 B-roll per 30-45 seconds of content
   - Never place B-roll during the first 5 seconds or last 5 seconds

2. **text_overlays**: Array of animated text callouts for key points. For each:
   - `start_ms`: When to show (ms from video start)
   - `duration_ms`: How long (typically 2000-3000ms)
   - `text`: The text to display (keep under 6 words)
   - `position`: One of "center", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"
   - `animation`: One of "pop", "slide-up", "slide-left", "fade"
   - `reason`: Why this moment deserves emphasis

   Guidelines:
   - Highlight key stats, numbers, or important claims
   - Show topic titles when transitioning between subjects
   - Max 1 text overlay per 20 seconds
   - Don't overlap with B-roll timings

3. **lower_third_adjustments**: Any changes to existing lower thirds (or new ones to add). For each:
   - `start_ms`: Adjusted timing
   - `duration_ms`: Duration
   - `name`: Name to display
   - `title`: Title/role to display
   - `reason`: Why this timing/content

4. **chapter_markers**: Topic segments for YouTube chapters. For each:
   - `start_ms`: Start of this topic
   - `title`: Chapter title (under 50 chars)

Return ONLY valid JSON. No markdown, no explanation outside the JSON.

{{
  "b_roll_suggestions": [...],
  "text_overlays": [...],
  "lower_third_adjustments": [...],
  "chapter_markers": [...]
}}"""

STYLE_DESCRIPTIONS = {
    "professional": "Clean, minimal overlays. B-roll for visual variety. Subtle text overlays for key stats only.",
    "energetic": "Frequent B-roll cuts, bold text overlays, dynamic pacing. Good for motivational or startup content.",
    "educational": "Topic titles on transitions, emphasis on key terms and definitions, clear chapter structure.",
    "conversational": "Light touch — occasional B-roll, minimal text overlays, natural flow. Let the speaker carry it.",
    "cinematic": "Longer B-roll holds, minimal text, atmospheric stock footage. Focus on visual storytelling.",
}


def analyze_transcript_with_claude(edl: dict, style: str = "professional") -> dict:
    """
    Send transcript to Claude for creative analysis.

    Returns dict with b_roll_suggestions, text_overlays, lower_third_adjustments, chapter_markers.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found in .env")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    transcript_text = edl.get("transcript", {}).get("full_text", "")
    if not transcript_text:
        print("  Warning: No transcript text found in EDL")
        return {"b_roll_suggestions": [], "text_overlays": [], "lower_third_adjustments": [], "chapter_markers": []}

    # Build timestamped transcript for better context
    words = edl.get("transcript", {}).get("words", [])
    timestamped_lines = []
    current_line = []
    line_start_ms = 0

    for w in words:
        if not current_line:
            line_start_ms = w["startMs"]
        current_line.append(w["text"])

        if len(current_line) >= 10 or w["text"].endswith(('.', '?', '!')):
            timestamp = f"[{line_start_ms/1000:.1f}s]"
            timestamped_lines.append(f"{timestamp} {' '.join(current_line)}")
            current_line = []

    if current_line:
        timestamp = f"[{line_start_ms/1000:.1f}s]"
        timestamped_lines.append(f"{timestamp} {' '.join(current_line)}")

    timestamped_transcript = "\n".join(timestamped_lines) if timestamped_lines else transcript_text

    style_desc = STYLE_DESCRIPTIONS.get(style, STYLE_DESCRIPTIONS["professional"])

    prompt = ENHANCEMENT_PROMPT.format(
        title=edl.get("project", {}).get("title", "Untitled"),
        duration_seconds=edl.get("project", {}).get("source_duration_seconds", 0),
        transcript=timestamped_transcript,
        lower_third_count=len(edl.get("overlays", {}).get("lower_thirds", [])),
        text_overlay_count=len(edl.get("overlays", {}).get("text_overlays", [])),
        style=f"{style} — {style_desc}",
    )

    print(f"  Analyzing transcript with Claude ({style} style)...")

    for attempt in range(CIRCUIT_BREAKER["max_retries"]):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=CIRCUIT_BREAKER["max_tokens"],
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = response.content[0].text.strip()

            # Extract JSON from response (handle possible markdown wrapping)
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
                return result
            else:
                print(f"  Warning: Could not find JSON in Claude response (attempt {attempt+1})")

        except json.JSONDecodeError as e:
            print(f"  Warning: Invalid JSON from Claude (attempt {attempt+1}): {e}")
        except Exception as e:
            print(f"  Warning: Claude API error (attempt {attempt+1}): {e}")

    print("  Error: Failed to get valid response from Claude after retries")
    return {"b_roll_suggestions": [], "text_overlays": [], "lower_third_adjustments": [], "chapter_markers": []}


def apply_enhancements(edl: dict, enhancements: dict, include_broll: bool = True) -> dict:
    """
    Apply Claude's creative decisions to the EDL.
    """
    brand_config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'brand.json')
    brand = {}
    if os.path.exists(brand_config_path):
        with open(brand_config_path, 'r') as f:
            brand = json.load(f)

    primary_color = brand.get("colors", {}).get("primary", "#FFD700")
    font_family = brand.get("fonts", {}).get("heading", "'SF Pro Display', sans-serif")

    # Apply text overlays
    new_text_overlays = []
    for to in enhancements.get("text_overlays", []):
        new_text_overlays.append({
            "start_ms": to["start_ms"],
            "duration_ms": to.get("duration_ms", 3000),
            "props": {
                "text": to["text"],
                "position": to.get("position", "center"),
                "fontSize": 48,
                "fontWeight": 700,
                "textColor": "#FFFFFF",
                "accentColor": primary_color,
                "animation": to.get("animation", "pop"),
                "fontFamily": font_family,
            },
        })

    existing_text = edl.get("overlays", {}).get("text_overlays", [])
    edl["overlays"]["text_overlays"] = existing_text + new_text_overlays
    print(f"    Text overlays: +{len(new_text_overlays)} (total: {len(edl['overlays']['text_overlays'])})")

    # Apply lower third adjustments
    lt_adjustments = enhancements.get("lower_third_adjustments", [])
    if lt_adjustments:
        new_lower_thirds = []
        for lt in lt_adjustments:
            new_lower_thirds.append({
                "composition": "LowerThird",
                "start_ms": lt["start_ms"],
                "duration_ms": lt.get("duration_ms", 4000),
                "props": {
                    "name": lt.get("name", "Trey Cooper"),
                    "title": lt.get("title", "Founder, Stay Starving"),
                    "accentColor": primary_color,
                },
            })
        edl["overlays"]["lower_thirds"] = new_lower_thirds
        print(f"    Lower thirds: updated to {len(new_lower_thirds)}")

    # Apply B-roll suggestions (saved separately for fetch_broll.py)
    broll_suggestions = enhancements.get("b_roll_suggestions", []) if include_broll else []
    if broll_suggestions:
        edl["overlays"]["b_roll"] = broll_suggestions
        print(f"    B-roll placements: {len(broll_suggestions)}")
    else:
        edl["overlays"]["b_roll"] = []

    # Apply chapter markers
    chapters = enhancements.get("chapter_markers", [])
    if chapters:
        edl["chapters"] = chapters
        print(f"    Chapter markers: {len(chapters)}")

    return edl


def enhance_edl(edl_path: str, style: str = "professional", include_broll: bool = True) -> dict:
    """
    Full enhancement pipeline: analyze → apply → save.
    """
    with open(edl_path, 'r') as f:
        edl = json.load(f)

    project_name = edl["project"]["name"]
    transcript_text = edl.get("transcript", {}).get("full_text", "")

    print(f"Enhancing: {project_name}")
    print(f"  Style: {style}")
    print(f"  Transcript: {len(transcript_text)} chars")
    print(f"  B-roll: {'enabled' if include_broll else 'disabled'}")

    if not transcript_text:
        print("  Skipping: No transcript available (run transcribe_video.py first)")
        return edl

    # Get Claude's creative analysis
    enhancements = analyze_transcript_with_claude(edl, style)

    # Summary of what Claude found
    print(f"\n  Claude's suggestions:")
    print(f"    B-roll moments: {len(enhancements.get('b_roll_suggestions', []))}")
    print(f"    Text overlays: {len(enhancements.get('text_overlays', []))}")
    print(f"    Lower third adjustments: {len(enhancements.get('lower_third_adjustments', []))}")
    print(f"    Chapter markers: {len(enhancements.get('chapter_markers', []))}")

    # Apply to EDL
    print(f"\n  Applying enhancements...")
    edl = apply_enhancements(edl, enhancements, include_broll)

    # Save updated EDL
    with open(edl_path, 'w') as f:
        json.dump(edl, f, indent=2)
    print(f"\n  Updated EDL: {edl_path}")

    # Save B-roll suggestions separately for fetch_broll.py
    if include_broll and enhancements.get("b_roll_suggestions"):
        broll_path = os.path.abspath(f".tmp/broll_suggestions_{project_name}.json")
        with open(broll_path, 'w') as f:
            json.dump(enhancements["b_roll_suggestions"], f, indent=2)
        print(f"  B-roll suggestions: {broll_path}")

    return edl


def main():
    parser = argparse.ArgumentParser(
        description="Enhance EDL with Claude-powered creative decisions"
    )
    parser.add_argument(
        "--edl",
        required=True,
        help="Path to EDL JSON"
    )
    parser.add_argument(
        "--style",
        choices=list(STYLE_DESCRIPTIONS.keys()),
        default="professional",
        help="Editing style (default: professional)"
    )
    parser.add_argument(
        "--no-broll",
        action="store_true",
        help="Skip B-roll suggestions"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Enhance EDL - WAT Framework (Claude Intelligence Layer)")
    print("=" * 60)

    enhance_edl(
        edl_path=args.edl,
        style=args.style,
        include_broll=not args.no_broll,
    )


if __name__ == "__main__":
    main()
