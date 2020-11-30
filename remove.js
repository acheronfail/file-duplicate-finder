const fs = require('fs-extra');
const path = require('path');

const duplicates = require('./duplicates-to-remove.json');

async function main() {
  const [, , /* node*/ /* script */ moveDestination] = process.argv;
  if (!moveDestination) {
    throw new Error(`Please pass a directory to move duplicate files`);
  }

  const newLocation = path.resolve(moveDestination);
  await fs.ensureDir(newLocation);

  for (const filePath of duplicates) {
    if (!(await fs.pathExists(filePath))) {
      continue;
    }

    const fileName = path.basename(filePath);
    let newFilePath = path.join(newLocation, fileName);
    while (await fs.pathExists(newFilePath)) {
      newFilePath = newFilePath + ' copy';
    }
    console.log(`Moving: ${filePath}`);
    console.log(`To: ${newFilePath}`);
    console.log();
    await fs.move(filePath, newFilePath);
  }
}

if (require.main === module) {
  main().then(undefined, (err) => {
    console.error(err);
    process.exit(1);
  });
}
