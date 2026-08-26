const FILE_SIZE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"];

export function formatFileSize(bytes: number) {
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1000 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1000;
    unitIndex++;
  }

  size = Math.round(size * 100) / 100;

  if (size >= 1000 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1000;
    unitIndex++;
  }

  return `${size} ${FILE_SIZE_UNITS[unitIndex]}`;
}
