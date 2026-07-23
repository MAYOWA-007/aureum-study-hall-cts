import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifest = JSON.parse(await readFile(resolve("public/audio/narration/manifest.json"), "utf8"));
const pack = JSON.parse(await readFile(resolve("public/audio/narration/pack.json"), "utf8"));
const clipsDirectory = resolve("public/audio/narration/clips");
const directoryEntries = await readdir(clipsDirectory);
const partialFiles = directoryEntries.filter((name) => name.endsWith(".partial"));
const mp3Names = new Set(directoryEntries.filter((name) => name.endsWith(".mp3")));
const expectedIds = manifest.clips.map((clip) => clip.id);
const expectedIdSet = new Set(expectedIds);
const indexedIdSet = new Set(pack.availableClipIds);
const issues = [];
let totalBytes = 0;

if (manifest.clipCount !== manifest.clips.length) issues.push("manifest clipCount does not match clips array");
if (expectedIdSet.size !== expectedIds.length) issues.push("manifest contains duplicate clip IDs");
if (pack.status !== "ready") issues.push(`pack status is ${pack.status}, not ready`);
if (pack.model !== "s2.1-pro") issues.push("pack model is not the approved s2.1-pro model");
if (pack.voiceReferenceId !== "f3b85abdea0e4e1c9fc60b4e3063a4a0") issues.push("pack voice reference does not match the approved voice");
if (indexedIdSet.size !== expectedIdSet.size) issues.push("pack index count does not match manifest count");
if (partialFiles.length) issues.push(`found ${partialFiles.length} partial files`);

for (const id of expectedIds) {
  const filename = `${id}.mp3`;
  if (!indexedIdSet.has(id)) issues.push(`clip is not indexed: ${id}`);
  if (!mp3Names.has(filename)) {
    issues.push(`clip file is missing: ${filename}`);
    continue;
  }
  const path = resolve(clipsDirectory, filename);
  const info = await stat(path);
  totalBytes += info.size;
  if (info.size < 200) issues.push(`clip is unexpectedly small: ${filename}`);
  const handle = await readFile(path);
  const hasId3Header = handle.subarray(0, 3).toString("ascii") === "ID3";
  const hasMp3Frame = handle[0] === 0xff && (handle[1] & 0xe0) === 0xe0;
  if (!hasId3Header && !hasMp3Frame) issues.push(`clip does not have an MP3 header: ${filename}`);
}

for (const filename of mp3Names) {
  if (!expectedIdSet.has(filename.replace(/\.mp3$/, ""))) issues.push(`unexpected MP3 file: ${filename}`);
}

const audit = {
  status: issues.length ? "FAIL" : "PASS",
  checkedAt: new Date().toISOString(),
  provider: pack.provider,
  model: pack.model,
  voiceReferenceId: pack.voiceReferenceId,
  manifestClips: expectedIds.length,
  indexedClips: indexedIdSet.size,
  mp3Files: mp3Names.size,
  totalBytes,
  totalMegabytes: Number((totalBytes / 1_000_000).toFixed(1)),
  partialFiles: partialFiles.length,
  issues,
};

await writeFile(resolve("audits/narration-pack-audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify(audit, null, 2));
if (issues.length) process.exitCode = 1;
