import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const manifest = JSON.parse(await readFile(resolve("public/audio/narration/manifest.json"), "utf8"));
const packPath = resolve("public/audio/narration/pack.json");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const kindArg = process.argv.find((value) => value.startsWith("--kind="));
const questionArg = process.argv.find((value) => value.startsWith("--question="));
const concurrencyArg = process.argv.find((value) => value.startsWith("--concurrency="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1])) : Number.POSITIVE_INFINITY;
const kind = kindArg?.split("=")[1];
const questionId = questionArg ? Number(questionArg.split("=")[1]) : null;
const concurrency = Math.min(5, Math.max(1, concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 3));

async function existsWithAudio(path) {
  try { return (await stat(path)).size >= 200; } catch { return false; }
}

const selected = manifest.clips
  .filter((clip) => !kind || clip.kind === kind)
  .filter((clip) => questionId === null || clip.questionId === questionId)
  .slice(0, limit);
const missing = [];
const available = new Set();
for (const clip of manifest.clips) {
  const output = resolve("public", clip.audioPath.replace(/^\.\//, ""));
  if (await existsWithAudio(output)) available.add(clip.id);
  else if (selected.some((candidate) => candidate.id === clip.id)) missing.push({ clip, output });
}

const bytes = missing.reduce((sum, item) => sum + Buffer.byteLength(item.clip.ttsText, "utf8"), 0);
console.log(`${execute ? "EXECUTE" : "DRY RUN"}: ${missing.length} missing clips selected; ${bytes.toLocaleString()} UTF-8 bytes.`);
if (!execute) {
  console.log("No API request was made. Add --execute only after the exact Fish voice and model are approved.");
  process.exit(0);
}

const apiKey = process.env.FISH_AUDIO_API_KEY;
const referenceId = process.env.FISH_REFERENCE_ID;
const model = process.env.FISH_TTS_MODEL;
if (!apiKey || !referenceId || !model) {
  throw new Error("Execution requires FISH_AUDIO_API_KEY, FISH_REFERENCE_ID, and FISH_TTS_MODEL in the private shell environment.");
}
if (!/^[a-f0-9]{32}$/i.test(referenceId)) throw new Error("FISH_REFERENCE_ID must be a 32-character hexadecimal Fish voice reference ID.");

let packWrite = Promise.resolve();
let generatedThisRun = 0;
function checkpointPack() {
  const allAvailable = [...available].sort();
  const pack = {
    schemaVersion: 1,
    status: allAvailable.length === manifest.clips.length ? "ready" : "partial",
    provider: "Fish Audio",
    model,
    voiceReferenceId: referenceId,
    generatedAt: new Date().toISOString(),
    availableClipIds: allAvailable,
  };
  packWrite = packWrite.then(() => writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8"));
  return packWrite;
}

async function synthesize(item) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          model,
        },
        body: JSON.stringify({
          text: item.clip.ttsText,
          reference_id: referenceId,
          format: "mp3",
          mp3_bitrate: 64,
          normalize: true,
          latency: "normal",
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) {
        const retryable = [408, 409, 425, 429].includes(response.status) || response.status >= 500;
        if (retryable && attempt < 3) continue;
        throw new Error(`Fish Audio returned HTTP ${response.status}.`);
      }
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length < 200) throw new Error("Fish Audio returned an unexpectedly small audio payload.");
      await mkdir(dirname(item.output), { recursive: true });
      const temporary = `${item.output}.partial`;
      await writeFile(temporary, audio);
      await rename(temporary, item.output);
      available.add(item.clip.id);
      generatedThisRun += 1;
      await checkpointPack();
      if (generatedThisRun === 1 || generatedThisRun % 25 === 0 || generatedThisRun === missing.length) {
        console.log(`Generated ${generatedThisRun}/${missing.length} selected clips; ${available.size}/${manifest.clips.length} in pack.`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 750));
    }
  }
  throw lastError;
}

let nextIndex = 0;
async function worker() {
  while (nextIndex < missing.length) {
    const item = missing[nextIndex];
    nextIndex += 1;
    await synthesize(item);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, () => worker()));

await checkpointPack();
console.log(`Voice pack now contains ${available.size} of ${manifest.clips.length} clips.`);
