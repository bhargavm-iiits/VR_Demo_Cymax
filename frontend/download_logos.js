import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const icons = [
    { name: 'bhim.svg', url: 'https://cdn.worldvectorlogo.com/logos/bhim.svg' },
    { name: 'amazonpay.svg', url: 'https://cdn.worldvectorlogo.com/logos/amazon-pay.svg' },
];

const destFolder = path.join(__dirname, 'public', 'payment-icons');
if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

async function download(urlStr, dest) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        https.get(options, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return download(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to get '${urlStr}' (${response.statusCode})`));
            }
            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => { file.close(resolve); });
        }).on('error', (err) => { fs.unlink(dest, () => reject(err)); });
    });
}

async function main() {
    for (let icon of icons) {
        try {
            await download(icon.url, path.join(destFolder, icon.name));
            console.log(`Downloaded ${icon.name}`);
        } catch(e) {
            console.error(`Error downloading ${icon.name}:`, e.message);
        }
    }
}
main();
