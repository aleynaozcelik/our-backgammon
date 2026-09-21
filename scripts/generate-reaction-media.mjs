import { readdirSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const images = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp', '.apng']);
const videos = new Set(['.mp4', '.webm', '.ogv', '.mov', '.m4v', '.avi', '.mkv']);
const convert = new Set(['.mov', '.m4v', '.avi', '.mkv']);

function scan(folder) {
  const directory = join('public/assets/images', folder);
  return readdirSync(directory).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).flatMap((name) => {
    const extension = extname(name).toLowerCase();
    const input = join(directory, name);
    if (!statSync(input).isFile() || (!images.has(extension) && !videos.has(extension))) return [];
    let src = `/assets/images/${folder}/${name}`;
    if (convert.has(extension)) {
      const outputDirectory = 'public/assets/reaction-videos';
      mkdirSync(outputDirectory, { recursive: true });
      const outputName = `${folder}-${name}.mp4`;
      const output = join(outputDirectory, outputName);
      const outputStat = statSync(output, { throwIfNoEntry: false });
      if (!outputStat || outputStat.mtimeMs < statSync(input).mtimeMs) {
        try {
          execFileSync('ffmpeg', ['-y', '-i', input, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', output], { stdio: 'pipe' });
        } catch (error) {
          throw new Error(`Cannot convert ${input}. Install FFmpeg or supply an H.264 MP4 instead.`, { cause: error });
        }
      }
      src = `/assets/reaction-videos/${outputName}`;
    }
    return [{ name, src, kind: videos.has(extension) ? 'video' : 'image' }];
  });
}

const bad = scan('badMoves');
const first = bad.find((media) => /^bad-move\.[^.]+$/i.test(media.name));
if (!first) throw new Error('Missing first capture reaction: bad-move.mp4');
const manifest = { first, bad: bad.filter((media) => media !== first), nice: scan('niceMoves') };
if (!manifest.bad.length || !manifest.nice.length) throw new Error('Reaction media folders must not be empty.');
writeFileSync('lib/game/reaction-media.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Reaction media: ${manifest.bad.length} bad, ${manifest.nice.length} nice, 1 first capture.`);
