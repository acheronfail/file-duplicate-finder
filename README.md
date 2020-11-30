# File Duplicate Finder

A simple script that finds duplicate files by checking:

- the file size
- the start, middle, and end regions of the file
- the file hash (sha256)

Use at your own risk!

## Usage

```bash
# Search for duplicates in the following directory
node index.js path/to/folder/to/scan
# now duplicates-to-remove.json will exist in the current working directory
# if you're happy to remove them all, run
node remove.js path/to/move/duplicate/files
```

