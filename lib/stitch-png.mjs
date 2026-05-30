/**
 * 纵向拼接 PNG（无重叠分块）
 */
import fs from "fs";
import { PNG } from "pngjs";

export function stitchPngVertical(parts, outPath) {
  const images = parts.map((p) => PNG.sync.read(fs.readFileSync(p.path)));
  const width = images[0].width;
  const totalHeight = parts.reduce((s, p) => s + p.height, 0);
  const out = new PNG({ width, height: totalHeight });

  let y = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const h = parts[i].height;
    for (let row = 0; row < h; row++) {
      const srcStart = row * img.width * 4;
      const dstStart = (y + row) * width * 4;
      img.data.copy(out.data, dstStart, srcStart, srcStart + width * 4);
    }
    y += h;
  }
  fs.writeFileSync(outPath, PNG.sync.write(out));
}
