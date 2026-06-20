import sharp from "sharp";
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import fs from "fs";
import path from "path";

interface FrameInfo {
  path: string;
  delay: number;
  index: number;
}

interface PlacementOptions {
  baseWidth: number;
  baseHeight: number;
  baseLeft: number;
  baseTop: number;
}

const FRAME_DIR = path.join(__dirname, "frames");

async function resolveInput(source: string): Promise<string | Buffer> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${source} (status ${response.status})`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  return source;
}

async function compositeFramesToGif(
  baseImagePath: string,
  frames: FrameInfo[],
  placement: PlacementOptions
): Promise<Buffer> {
  const firstFrameMeta = await sharp(frames[0]!.path).metadata();
  const canvasWidth = firstFrameMeta.width!;
  const canvasHeight = firstFrameMeta.height!;

  const baseImage = await resolveInput(baseImagePath);
  const resizedBase = await sharp(baseImage)
    .resize(placement.baseWidth, placement.baseHeight, { fit: "cover" })
    .toBuffer();

  const gif = GIFEncoder();

  for (const frame of frames) {
    const composited = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: resizedBase,
          left: placement.baseLeft,
          top: placement.baseTop,
        },
        {
          input: frame.path,
          left: 0,
          top: 0,
        },
      ])
      .ensureAlpha()
      .raw()
      .toBuffer();

    const data = new Uint8Array(composited);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    gif.writeFrame(index, canvasWidth, canvasHeight, {
      palette,
      delay: frame.delay,
      transparent: false,
    });
  }

  gif.finish();
  return gif.buffer;
}

function parseFrameFilename(
  filename: string,
  fallBackIndex: number
): { index: number; delaySeconds: number } | null {
  const match = filename.match(/frame_(\d+)_delay-([\d.]+)s/);
  if (!match) return null;

  const index = match[1] ? parseInt(match[1], 10) : fallBackIndex;
  const delaySeconds = match[2] ? parseFloat(match[2]) : 0.1;

  return {
    index,
    delaySeconds,
  };
}

function loadFrames(framesDir: string): FrameInfo[] {
  const files = fs.readdirSync(framesDir).filter((f) => f.endsWith(".png"));
  return files
    .map((f, index) => {
      const parsed = parseFrameFilename(f, index);
      if (!parsed) return null;
      return {
        path: path.join(framesDir, f),
        delay: Math.round(parsed.delaySeconds * 1000),
        index: parsed.index,
      };
    })
    .filter((f): f is FrameInfo => f !== null)
    .sort((a, b) => a.index - b.index);
}

export async function eatFood(food: string) {
  const frames = loadFrames(FRAME_DIR);

  if (frames.length === 0) {
    console.error("No frames found");
    return null;
  }

  return await compositeFramesToGif(food, frames, {
    baseWidth: 83,
    baseHeight: 83,
    baseLeft: 59,
    baseTop: 112,
  });
}
