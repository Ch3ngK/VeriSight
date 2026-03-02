import fs from 'fs';
import path from 'path';

async function main() {
  // Dynamically import modules to work in ESM/ts-node environments
  const ytdlMod: any = await import('ytdl-core');
  const ytdl = ytdlMod.default || ytdlMod;

  const ffmpegMod: any = await import('fluent-ffmpeg');
  const ffmpeg = ffmpegMod.default || ffmpegMod;

  const ffmpegPathMod: any = await import('ffmpeg-static');
  const ffmpegPath = ffmpegPathMod.default || ffmpegPathMod;

  ffmpeg.setFfmpegPath(ffmpegPath);

  const deepfakeMod: any = await import('../src/lib/deepfakeDetection');
  const detectDeepfakes = deepfakeMod.detectDeepfakes || deepfakeMod.default || deepfakeMod;

  async function extractFramesFromYouTube(url: string, outDir: string, count = 3) {
    return new Promise<string[]>((resolve, reject) => {
      const stream = ytdl(url, { quality: 'highestvideo' });

      ffmpeg(stream)
        .on('error', (err: any) => reject(err))
        .on('end', () => {
          const files = fs.readdirSync(outDir).filter(f => f.startsWith('frame-')).map(f => path.join(outDir, f));
          resolve(files);
        })
        .screenshots({
          count,
          folder: outDir,
          filename: 'frame-%03d.jpg',
          size: '640x?'
        });
    });
  }

  async function run(url: string) {
    if (!ytdl.validateURL(url)) {
      console.error('Invalid YouTube URL');
      process.exit(1);
    }

    const videoId = ytdl.getURLVideoID(url);
    const outDir = path.join(process.cwd(), 'tmp_deepfake', videoId);
    fs.mkdirSync(outDir, { recursive: true });

    console.log('Extracting frames...');
    const framesFiles = await extractFramesFromYouTube(url, outDir, 3);
    console.log('Frames saved:', framesFiles);

    // Convert frames to hex strings expected by detectDeepfakes
    const framesHex = framesFiles.map(f => fs.readFileSync(f).toString('hex'));

    console.log('Running deepfake detector...');
    const result = await detectDeepfakes(framesHex);

    console.log('Deepfake analysis result:');
    console.log(JSON.stringify(result, null, 2));
  }

  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npm run deepfake:test -- <youtube_url>');
    process.exit(1);
  }

  try {
    await run(url);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
