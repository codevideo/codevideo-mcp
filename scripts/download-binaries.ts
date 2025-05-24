import { createWriteStream, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLATFORMS = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'win32', arch: 'x64' }
];

async function downloadBinaries(version: string) {
  const baseUrl = `https://github.com/codevideo/codevideo-cli/releases/download/${version}`;
  
  for (const { platform, arch } of PLATFORMS) {
    const ext = platform === 'win32' ? '.exe' : '';
    const fileName = `codevideo-cli-${platform}-${arch}${ext}`;
    const binaryName = `codevideo-cli${ext}`;
    
    const binDir = join(__dirname, '..', 'bin', `${platform}-${arch}`);
    mkdirSync(binDir, { recursive: true });
    
    const downloadUrl = `${baseUrl}/${fileName}`;
    const outputPath = join(binDir, binaryName);
    
    console.log(`Downloading ${downloadUrl} to ${outputPath}`);
    
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${downloadUrl}: ${response.statusText}`);
    }
    
    await pipeline(response.body!, createWriteStream(outputPath));
    
    // Make executable on Unix-like systems
    if (platform !== 'win32') {
      chmodSync(outputPath, 0o755);
    }
  }
  
  console.log('All binaries downloaded successfully!');
}

// Usage: npm run download-binaries v1.2.3
const version = process.argv[2];
if (!version) {
  console.error('Usage: npm run download-binaries <version>');
  process.exit(1);
}

downloadBinaries(version).catch(console.error);