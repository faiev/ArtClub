#!/usr/bin/env python3
"""Regenerate the tiny synthetic export-gallery assets (requires Pillow).

This script is only for rebuilding documentation examples. The Art Club
exporters themselves remain plain JavaScript and have no Python/Pillow runtime
dependency.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT_PATH = ROOT / "walk-cycle.project.json"
PNG_PATH = ROOT / "walk-cycle.png"
GIF_PATH = ROOT / "walk-cycle.gif"
PNG_META_PATH = ROOT / "walk-cycle.metadata.json"
GIF_META_PATH = ROOT / "walk-cycle.gif.metadata.json"


def rgb(color: str) -> tuple[int, int, int, int]:
    if len(color) != 7 or color[0] != "#":
        raise ValueError(f"Invalid project color: {color!r}")
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def gif_layout_info(data: bytes) -> tuple[int, list[bool]]:
    if data[:6] != b"GIF89a":
        raise ValueError("Generated sample is not GIF89a")
    offset = 13
    packed = data[10]
    global_entries = 1 << ((packed & 7) + 1) if packed & 0x80 else 0
    offset += global_entries * 3
    local_tables: list[bool] = []

    while offset < len(data):
        marker = data[offset]
        offset += 1
        if marker == 0x3B:
            break
        if marker == 0x21:
            label = data[offset]
            offset += 1
            if label == 0xF9:
                block_size = data[offset]
                offset += 1 + block_size + 1
            elif label == 0xFF:
                app_size = data[offset]
                offset += 1 + app_size
                while data[offset]:
                    size = data[offset]
                    offset += 1 + size
                offset += 1
            else:
                while data[offset]:
                    size = data[offset]
                    offset += 1 + size
                offset += 1
            continue
        if marker != 0x2C:
            raise ValueError(f"Unexpected GIF block marker: 0x{marker:02x}")
        descriptor = data[offset:offset + 9]
        if len(descriptor) != 9:
            raise ValueError("Truncated GIF image descriptor")
        image_flags = descriptor[8]
        offset += 9
        uses_local = bool(image_flags & 0x80)
        local_tables.append(uses_local)
        if uses_local:
            offset += 3 * (1 << ((image_flags & 7) + 1))
        offset += 1  # LZW minimum code size
        while data[offset]:
            size = data[offset]
            offset += 1 + size
        offset += 1
    return global_entries, local_tables


def main() -> None:
    project = json.loads(PROJECT_PATH.read_text(encoding="utf-8"))
    width = project["canvas"]["width"]
    height = project["canvas"]["height"]
    if project.get("format") != "one-pixel-studio" or project.get("version") != 2:
        raise ValueError("Expected a v2 One Pixel Studio project")
    if not (1 <= width <= 512 and 1 <= height <= 512):
        raise ValueError("Canvas dimensions exceed the documented example limits")

    frames = project["frames"]
    layers = [layer for layer in project["layers"] if layer["visible"]]
    cels = {(cel["layerId"], cel["frameId"]): cel for cel in project["cels"]}
    frame_images = []
    for frame in frames:
        raster = [None] * (width * height)
        for layer in layers:
            cel = cels.get((layer["id"], frame["id"]))
            if cel is None:
                continue
            pixels = cel["pixels"]
            if len(pixels) != width * height:
                raise ValueError(f"Cel {frame['id']} has an invalid pixel count")
            for index, color in enumerate(pixels):
                if color is not None:
                    raster[index] = color
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        image.putdata([(0, 0, 0, 0) if c is None else rgb(c) for c in raster])
        frame_images.append(image)

    # 2×2 atlas, 1px margin and 1px spacing.
    columns = 2
    rows = (len(frame_images) + columns - 1) // columns
    margin = 1
    spacing = 1
    sheet_width = margin * 2 + columns * width + (columns - 1) * spacing
    sheet_height = margin * 2 + rows * height + (rows - 1) * spacing
    atlas = Image.new("RGBA", (sheet_width, sheet_height), (0, 0, 0, 0))
    frame_records = []
    for index, (frame, image) in enumerate(zip(frames, frame_images)):
        x = margin + (index % columns) * (width + spacing)
        y = margin + (index // columns) * (height + spacing)
        atlas.alpha_composite(image, (x, y))
        frame_records.append({
            "index": index,
            "frameId": frame["id"],
            "name": frame["name"],
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "durationMs": frame["durationMs"],
        })
    atlas.save(PNG_PATH, format="PNG", optimize=True)

    png_metadata = {
        "format": "one-pixel-studio-sprite-sheet",
        "version": 1,
        "image": {"filename": PNG_PATH.name, "width": sheet_width, "height": sheet_height},
        "canvas": {"frameWidth": width, "frameHeight": height},
        "layout": {
            "type": "grid",
            "columns": columns,
            "rows": rows,
            "margin": margin,
            "spacing": spacing,
        },
        "frameCount": len(frame_records),
        "frames": frame_records,
    }
    PNG_META_PATH.write_text(json.dumps(png_metadata, separators=(",", ":")) + "\n", encoding="utf-8")

    # Pillow makes a compact illustration of GIF's centisecond timing and
    # transparency rules. It is intentionally not presented as encoder output.
    source_durations = [frame["durationMs"] for frame in frames]
    effective_durations = [((duration + 5) // 10) * 10 for duration in source_durations]
    frame_images[0].save(
        GIF_PATH,
        format="GIF",
        save_all=True,
        append_images=frame_images[1:],
        duration=effective_durations,
        loop=0,
        disposal=2,
        transparency=0,
        optimize=False,
    )
    gif_data = GIF_PATH.read_bytes()
    global_entries, local_tables = gif_layout_info(gif_data)
    opaque_colors = {
        color
        for cel in project["cels"]
        for color in cel["pixels"]
        if color is not None
    }
    gif_metadata = {
        "format": "one-pixel-studio-gif",
        "version": 1,
        "image": {"mimeType": "image/gif", "width": width, "height": height},
        "frameCount": len(frames),
        "frames": [
            {
                "index": index,
                "frameId": frame["id"],
                "name": frame["name"],
                "width": width,
                "height": height,
                "durationMs": frame["durationMs"],
                "encodedDelayCentiseconds": effective_durations[index] // 10,
                "effectiveDurationMs": effective_durations[index],
            }
            for index, frame in enumerate(frames)
        ],
        "diagnostics": {
            "sampleBinary": "Pillow-generated format illustration; not byte-for-byte output from js/gif-export.js",
            "paletteMode": "exact source colors in this sample",
            "opaquePaletteColors": len(opaque_colors),
            "globalColorTableEntries": global_entries,
            "usesFrameLocalColorTables": any(local_tables),
            "transparentIndex": 0,
            "transparency": "One reserved fully-transparent palette index; GIF transparency is binary",
            "disposal": "Background (2)",
            "loopCount": 0,
            "loopBehavior": "Infinite loop",
            "totalFramePixels": width * height * len(frames),
            "timingNote": "145 ms rounds to 150 ms and 155 ms rounds to 160 ms at GIF 10 ms centisecond precision.",
        },
    }
    GIF_META_PATH.write_text(json.dumps(gif_metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
