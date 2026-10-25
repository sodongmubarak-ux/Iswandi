import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Allow json payloads up to 30mb for photo scanning
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Gemini Scan endpoint for Handwritten Fish Catch Records
app.post('/api/gemini/scan', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Tidak ada foto yang dikirimkan.' });
    }

    const apiKey = (req.headers['x-gemini-api-key'] as string) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key Gemini belum disetel. Masukkan API Key di menu Pengaturan atau hubungkan kunci rahasia AI Studio.',
      });
    }

    // Clean base64 data url if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `Anda adalah asisten cerdas spesialis membaca dan mendigitalisasi catatan tulisan tangan hasil tangkapan nelayan / kapal ikan Indonesia.
Tugas Anda:
1. Baca teks, nama ikan (contoh: Tongkol, Layang, Soret, Kunyitan, Katombong, Baga-Baga, Ikan Kuning, Campur, Lainnya, Cakalang, Tenggiri, dll), berat dalam kg, harga per kg jika tertulis, serta subtotal / total.
2. Identifikasi tanggal catatan jika ada, nama rumpon / lokasi jika ada, dan catatan lain (seperti nama kapal, pemikul, ABK, cuaca).
3. Jika tulisan agak samar atau tidak terbaca sempurna, berikan tebakan terbaik dengan field confidence: "uncertain". Jika terbaca jelas, confidence: "high".
4. Kembalikan data HANYA dalam format JSON valid dengan struktur:
{
  "tanggal": "YYYY-MM-DD atau tanggal terbaca",
  "rumpon": "Nama rumpon atau lokasi atau kosong",
  "items": [
    {
      "namaIkan": "Nama jenis ikan",
      "beratKg": 10.5,
      "hargaPerKg": 25000,
      "subtotal": 262500,
      "confidence": "high"
    }
  ],
  "totalHarga": 1500000,
  "catatan": "Keterangan tambahan yang tertulis"
}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: 'Tolong baca dan digitalisasi catatan tulisan tangan hasil ikan dari foto ini ke dalam format JSON yang diminta.',
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });
    } catch (primaryErr: unknown) {
      const errStr = String(primaryErr);
      if (errStr.includes('503') || errStr.includes('high demand') || errStr.includes('UNAVAILABLE') || errStr.includes('429')) {
        console.warn('Gemini 3.8 Flash high demand, trying Gemini 3.1 Flash Lite fallback...');
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: 'Tolong baca dan digitalisasi catatan tulisan tangan hasil ikan dari foto ini ke dalam format JSON yang diminta.',
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });
      } else {
        throw primaryErr;
      }
    }

    const responseText = response.text || '{}';
    let parsedData = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // attempt to extract json block
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      } else {
        throw new Error('Gagal mengurai respons AI ke format JSON.');
      }
    }

    return res.json({ success: true, data: parsedData });
  } catch (error: unknown) {
    console.error('Scan Error:', error);
    const msg = error instanceof Error ? error.message : 'Terjadi kegagalan saat menganalisis foto dengan AI.';
    return res.status(500).json({ error: msg });
  }
});

// Download full repository ZIP for GitHub upload (built specifically for users on Android without PC)
app.get('/api/download-full-project.zip', (_req: Request, res: Response) => {
  const directZip = path.resolve(process.cwd(), 'public/catatan-by-iswandi-source.zip');
  const assetZip = path.resolve(process.cwd(), 'public/assets/aistudio/catatan-by-iswandi-source__1__d1b64de0.zip');

  const sendFile = (filePath: string) => {
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="catatan-by-iswandi-source.zip"');
    res.setHeader('Content-Length', stat.size);
    const filestream = fs.createReadStream(filePath);
    filestream.pipe(res);
  };

  if (fs.existsSync(directZip)) {
    return sendFile(directZip);
  }

  if (fs.existsSync(assetZip)) {
    return sendFile(assetZip);
  }

  res.status(404).json({ error: 'File zip proyek belum tersedia.' });
});

// Download android project tar.gz
app.get('/api/download-android-project', (_req: Request, res: Response) => {
  const tarPath = '/tmp/catatan-iswandi-android-project.tar.gz';
  try {
    execSync(`tar --exclude="node_modules" --exclude="build" --exclude=".gradle" -czf ${tarPath} -C /app/applet android`);
    if (fs.existsSync(tarPath)) {
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', 'attachment; filename="catatan-iswandi-android-project.tar.gz"');
      const filestream = fs.createReadStream(tarPath);
      filestream.pipe(res);
    } else {
      res.status(500).json({ error: 'Gagal membuat arsip Android.' });
    }
  } catch (err: unknown) {
    console.error('Failed to create android archive:', err);
    res.status(500).json({ error: 'Gagal membuat arsip proyek Android.' });
  }
});

// Direct 1-Click Push to GitHub for Android users without PC
app.post('/api/github/push', async (req: Request, res: Response) => {
  const stageDir = `/tmp/github_push_${Date.now()}`;
  try {
    const { repoUrl, token, username } = req.body;
    if (!repoUrl || !token) {
      return res.status(400).json({ error: 'URL Repositori GitHub dan Token (PAT) wajib diisi.' });
    }

    let cleanUrl = repoUrl.trim().replace(/\.git$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://github.com/${cleanUrl}`;
    }

    const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Format URL GitHub tidak valid. Contoh: https://github.com/username/catatan-iswandi' });
    }

    const owner = match[1];
    const repo = match[2];
    const user = username?.trim() || owner;
    const cleanToken = token.trim();

    const copyScript = `
import os, shutil

stage_dir = '${stageDir}'
os.makedirs(stage_dir, exist_ok=True)
base_dir = '/app/applet'
exclude_dirs = {'node_modules', '.git', 'dist', 'build-output', '.turbo'}
exclude_files = {'.DS_Store', 'bun.lock'}

for root, dirs, files in os.walk(base_dir):
    dirs[:] = [d for d in dirs if d not in exclude_dirs and d != '.git']
    for file in files:
        if file in exclude_files:
            continue
        full_path = os.path.join(root, file)
        rel = os.path.relpath(full_path, base_dir)
        dest = os.path.join(stage_dir, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(full_path, dest)
`;
    execSync(`python3 -c "${copyScript}"`);

    const remoteAuthUrl = `https://${encodeURIComponent(user)}:${encodeURIComponent(cleanToken)}@github.com/${owner}/${repo}.git`;
    
    execSync(`git init -b main`, { cwd: stageDir });
    execSync(`git config user.name "${user}"`, { cwd: stageDir });
    execSync(`git config user.email "${user}@users.noreply.github.com"`, { cwd: stageDir });
    execSync(`git add .`, { cwd: stageDir });
    execSync(`git commit -m "Catatan by Iswandi - Ready for automatic APK build"`, { cwd: stageDir });
    execSync(`git remote add origin "${remoteAuthUrl}"`, { cwd: stageDir });
    execSync(`git push -u origin main --force`, { cwd: stageDir, timeout: 60000 });

    try {
      execSync(`rm -rf ${stageDir}`);
    } catch {}

    return res.json({
      success: true,
      repoUrl: `https://github.com/${owner}/${repo}`,
      actionsUrl: `https://github.com/${owner}/${repo}/actions`,
      message: 'Semua file dan folder berhasil dikirim ke GitHub! GitHub Actions sekarang sedang membangun file APK Anda.',
    });
  } catch (err: unknown) {
    try {
      execSync(`rm -rf ${stageDir}`);
    } catch {}

    console.error('GitHub Push Error:', err);
    let msg = 'Gagal melakukan push ke GitHub.';
    if (err instanceof Error) {
      msg = err.message;
      if (msg.includes('Authentication failed') || msg.includes('Invalid username or password') || msg.includes('403')) {
        msg = 'Autentikasi gagal. Pastikan Token (PAT) memiliki izin "repo" dan nama repositori sudah dibuat di akun GitHub Anda.';
      } else if (msg.includes('Repository not found') || msg.includes('404')) {
        msg = 'Repositori tidak ditemukan. Pastikan Anda sudah membuat repositori baru di GitHub sebelum melakukan push.';
      }
    }
    return res.status(500).json({ error: msg });
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Catatan by Iswandi running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
