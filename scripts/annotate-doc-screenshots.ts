import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Add vector callouts around real browser pixels. Never redraw UI or task data.
// Edit crops/callouts in the manifest, then rerun this script.
const directory = resolve(import.meta.dirname, "../docs/assets/walkthrough");
const manifest = JSON.parse(
  await readFile(resolve(directory, "manifest.json"), "utf8"),
);
const escape = (value: string) =>
  value.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!,
  );
function dimensions(data: Buffer) {
  for (let i = 2; i < data.length;) {
    if (data[i] !== 0xff) throw new Error("Invalid JPEG marker");
    const marker = data[i + 1];
    const length = data.readUInt16BE(i + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker))
      return {
        height: data.readUInt16BE(i + 5),
        width: data.readUInt16BE(i + 7),
      };
    i += 2 + length;
  }
  throw new Error("JPEG dimensions unavailable");
}
for (const shot of manifest.screenshots) {
  if (shot.locale !== "en")
    throw new Error(`Expected English screenshot: ${shot.file}`);
  const data = await readFile(resolve(directory, "en", shot.file + ".jpg"));
  const size = dimensions(data);
  const [x, y, width, height] = shot.crop ?? [0, 0, size.width, size.height];
  if (x < 0 || y < 0 || x + width > size.width || y + height > size.height)
    throw new Error(`Crop outside screenshot: ${shot.file}`);
  const marks = shot.callouts
    .map(
      (point: {
        number: number;
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }) => {
        const px = point.x - x,
          py = point.y - y;
        if (
          px < 0 ||
          py < 0 ||
          px + point.width > width ||
          py + point.height > height
        )
          throw new Error(
            `Callout outside crop: ${shot.file} / ${point.number}`,
          );
        const cx = Math.max(15, px - 9),
          cy = Math.max(15, py + 7);
        return `<g><title>${escape(point.label)}</title><rect x="${px - 2}" y="${py - 2}" width="${point.width + 4}" height="${point.height + 4}" rx="4" fill="none" stroke="#b34708" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="13" fill="#a33d00" stroke="white" stroke-width="2"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="15" fill="white">${point.number}</text></g>`;
      },
    )
    .join("");
  const title = `OpenTask English interface: ${shot.file.replace(/^\d+-/, "").replaceAll("-", " ")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${escape(title)}</title><desc>Actual browser screenshot. Numbered callouts refer to the adjacent tutorial steps.</desc><image x="${-x}" y="${-y}" width="${size.width}" height="${size.height}" href="data:image/jpeg;base64,${data.toString("base64")}"/>${marks}</svg>\n`;
  await writeFile(resolve(directory, "en", shot.file + ".svg"), svg);
}
console.log(
  `Annotated ${manifest.screenshots.length} English screenshots; raw JPEGs preserved.`,
);
