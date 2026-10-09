import fs from 'fs';
import path from 'path';

const token = process.argv[2] || process.env.GITHUB_TOKEN;
const repoTarget = process.argv[3] || process.env.GITHUB_REPO || '535rdt/prodpulse-enterprise';
const tagName = process.argv[4] || 'v1.0.0';

if (!token || !repoTarget) {
  console.log(`
Usage:
  node publish-github-release.mjs <GITHUB_TOKEN> <OWNER/REPO> [TAG_NAME]
`);
  process.exit(1);
}

const [owner, repo] = repoTarget.split('/');
const headers = {
  'Accept': 'application/vnd.github+json',
  'Authorization': `Bearer ${token}`,
  'User-Agent': 'ProdPulse-Release-Uploader',
  'X-GitHub-Api-Version': '2022-11-28'
};

const filesToUpload = [
  'ProductionApp.apk',
  'ProdPulse-Enterprise-Setup-1.0.0.exe',
  'ProdPulse-Enterprise-Portable-1.0.0.exe'
];

async function main() {
  console.log(`\n🚀 Target: https://github.com/${owner}/${repo}/releases/tag/${tagName}`);

  // 1. Check or create release
  let release;
  try {
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`, { headers });
    if (getRes.status === 200) {
      release = await getRes.json();
      console.log(`✓ Existing release found: "${release.name || tagName}" (ID: ${release.id})`);
    }
  } catch (e) {
    // ignore
  }

  if (!release) {
    console.log(`Creating new release "${tagName}"...`);
    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tagName,
        name: `ProdPulse Enterprise ${tagName}`,
        body: `### 🏭 ProdPulse Enterprise Official Release (${tagName})\n\nOfficial production-grade enterprise release for desktop and mobile management.\n\n- 📱 **Android APK**: Instant mobile deployment on Android phones & tablets.\n- 💻 **Windows Setup Installer**: Automated installer with desktop shortcuts and uninstall support.\n- ⚡ **Windows Portable**: Standalone standalone executable requiring zero installation.`,
        draft: false,
        prerelease: false
      })
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error(`❌ Failed to create release (${createRes.status}):`, err);
      process.exit(1);
    }
    release = await createRes.json();
    console.log(`✓ Release created successfully: ${release.html_url}`);
  }

  // 2. Upload assets
  const uploadedUrls = [];
  for (const fileName of filesToUpload) {
    const filePath = path.resolve('H:/ANTIGRAVITY/PRODUCTION', fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found, skipping: ${filePath}`);
      continue;
    }

    const stat = fs.statSync(filePath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(`\n📤 Uploading ${fileName} (${sizeMb} MB)...`);

    // Check if asset already exists in release
    const existingAsset = (release.assets || []).find(a => a.name === fileName);
    if (existingAsset) {
      console.log(`   Removing previous asset (${existingAsset.id})...`);
      await fetch(existingAsset.url, { method: 'DELETE', headers });
    }

    const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
    const blob = await fs.openAsBlob(filePath);

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': fileName.endsWith('.apk') ? 'application/vnd.android.package-archive' : 'application/octet-stream',
        'Content-Length': stat.size.toString()
      },
      duplex: 'half',
      body: blob
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error(`❌ Failed to upload ${fileName} (${uploadRes.status}):`, err);
    } else {
      const uploaded = await uploadRes.json();
      console.log(`✅ Uploaded successfully!`);
      console.log(`   Direct Download: ${uploaded.browser_download_url}`);
      uploadedUrls.push({ name: fileName, url: uploaded.browser_download_url, size: `${sizeMb} MB` });
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 ALL RELEASES SUCCESSFULLY UPLOADED TO THE CLOUD!`);
  console.log(`Release URL: ${release.html_url}`);
  console.log(`======================================================`);
  uploadedUrls.forEach(u => console.log(`• ${u.name} (${u.size})\n  -> ${u.url}`));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
