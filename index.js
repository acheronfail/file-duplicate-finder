const readline = require('readline');
const chalk = require('chalk');
const crypto = require('crypto');
const fs = require('fs-extra');
const walk = require('klaw');

const FILE_TOO_SMALL = 'FILE TOO SMALL';

async function fileHash(path) {
  const hasher = crypto.createHash('sha256');
  hasher.write(await fs.readFile(path));
  return hasher.digest().toString('hex');
}

async function newSignature(entry) {
  if (entry.stats.size < 100) {
    return `${FILE_TOO_SMALL}: ${entry.path}`;
  }

  const chunkSize = 32;
  const filePositionStart = 0;
  const filePositionMiddle = Math.floor(entry.stats.size / 2);
  const filePositionEnd = entry.stats.size - chunkSize;
  const bufOffsetStart = 0;
  const bufOffsetMiddle = chunkSize * 1 - 1;
  const bufOffsetEnd = chunkSize * 2 - 1;
  const buffer = Buffer.alloc(chunkSize * 3);

  let bytesRead = 0;
  function checkRead() {
    if (bytesRead != chunkSize) {
      console.error(chalk.red(`Failed reading file: ${chalk.yellow(entry.path)}`));
    }
  }

  const fd = await fs.open(entry.path, 'r');
  ({ bytesRead } = await fs.read(fd, buffer, bufOffsetStart, chunkSize, filePositionStart));
  checkRead();
  ({ bytesRead } = await fs.read(fd, buffer, bufOffsetMiddle, chunkSize, filePositionMiddle));
  checkRead();
  ({ bytesRead } = await fs.read(fd, buffer, bufOffsetEnd, chunkSize, filePositionEnd));
  checkRead();
  await fs.close(fd);

  return `${entry.stats.size}-${buffer.toString('hex')}`;
}

async function main() {
  const [, , /* node */ /* script */ rootDirectory] = process.argv;
  if (!rootDirectory) {
    throw new Error('Please pass a directory in which to search for duplicates!');
  }

  const signatures = new Map();
  let fileCount = 0;
  let lastPrint = Date.now();

  function progress() {
    const now = Date.now();
    if (now - lastPrint > 500) {
      readline.clearLine(process.stderr, 0);
      readline.cursorTo(process.stderr, 0);
      process.stderr.write(`Files checked: ${fileCount}`);
      lastPrint = now;
    }
  }

  const walker = walk(rootDirectory, { fs });
  for await (const entry of walker) {
    if (entry.stats.isFile()) {
      const sig = await newSignature(entry);
      if (sig.startsWith(FILE_TOO_SMALL)) {
        console.warn(chalk.yellow(`File too small, skipping: ${entry.path}`));
        continue;
      }

      if (!signatures.has(sig)) {
        signatures.set(sig, [entry.path]);
      } else {
        signatures.get(sig).push(entry.path);
      }

      fileCount += 1;
      progress();
    }
  }

  progress();
  console.log();

  const duplicateCount = fileCount - signatures.size;
  console.log(chalk.cyan(`File Count: ${fileCount}`));
  console.log(chalk.cyan(`Unique items: ${signatures.size}`));
  console.log(chalk.cyan(`Duplicates: ${duplicateCount}`));

  const duplicatesSafeToRemove = [];
  if (duplicateCount > 0) {
    for (const [sig, paths] of signatures.entries()) {
      if (paths.length > 1) {
        console.log(chalk.red('These files are very likely the same:'));
        console.log(chalk.grey(`Signature: ${chalk.cyan(sig)}`));
        for (const p of paths) {
          console.log(chalk.yellow(`\t${p}`));
        }

        const hashes = new Set(await Promise.all(paths.map((p) => fileHash(p))));
        if (hashes.size === 1) {
          console.log(chalk.green(`All files hashes are the same: ${[...hashes.values()][0]}`));
          console.log(chalk.green(`Marking duplicates as safe to remove`));
          duplicatesSafeToRemove.push(...paths.slice(1));
        }
      }
    }
  }

  console.log(chalk.cyan(`File Count: ${fileCount}`));
  console.log(chalk.cyan(`Unique items: ${signatures.size}`));
  console.log(chalk.cyan(`Duplicates to remove: ${duplicatesSafeToRemove.length}`));
  console.log(chalk.cyan(`File Count - Removed: ${fileCount - duplicatesSafeToRemove.length}`));
  await fs.writeJson('duplicates-to-remove.json', duplicatesSafeToRemove, { spaces: 2 });
}

if (require.main === module) {
  main().then(undefined, (err) => {
    console.error(err);
    process.exit(1);
  });
}
