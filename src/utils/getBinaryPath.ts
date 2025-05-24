import { platform, arch } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export function getBinaryPath(): string {
    const platformMap: Record<string, string> = {
        'darwin': 'darwin',
        'linux': 'linux',
        'win32': 'win32'
    };

    const archMap: Record<string, string> = {
        'x64': 'x64',
        'arm64': 'arm64'
    };

    const targetPlatform = platformMap[platform()];
    const targetArch = archMap[arch()];

    if (!targetPlatform || !targetArch) {
        throw new Error(`Unsupported platform: ${platform()}-${arch()}`);
    }

    const binaryName = platform() === 'win32' ? 'codevideo-cli.exe' : 'codevideo-cli';
    const binaryPath = join(__dirname, '..', 'bin', `${targetPlatform}-${targetArch}`, binaryName);

    if (!existsSync(binaryPath)) {
        throw new Error(`Binary not found for ${targetPlatform}-${targetArch} at ${binaryPath}`);
    }

    return binaryPath;
}