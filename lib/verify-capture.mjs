/**
 * 校验截图是否合理（非拼接重复、高度足够）
 */
import fs from "fs";

export function readPngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function verifyCaptureFile(pngPath, { minHeight = 800 } = {}) {
  const buf = fs.readFileSync(pngPath);
  const { width, height } = readPngSize(buf);
  const issues = [];

  if (width < 1800) issues.push(`宽度不足1920: 实际${width}px`);
  if (height < minHeight) issues.push(`高度过短(可能截断): ${height}px`);

  return { ok: issues.length === 0, width, height, issues };
}
