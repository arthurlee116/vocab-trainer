import fs from 'fs/promises';
import path from 'path';
import { extractWordsFromImage } from '../src/services/vlm';

const IMAGE_PATH = path.resolve(
  __dirname,
  '../../ImageTest/1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg'
);

const encodeImage = async () => {
  const data = await fs.readFile(IMAGE_PATH);
  return `data:image/jpeg;base64,${data.toString('base64')}`;
};

const main = async () => {
  const image = await encodeImage();
  const words = await extractWordsFromImage([image]);
  console.log(`Words extracted: ${words.length}`);
  console.log(words.slice(0, 20));
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

