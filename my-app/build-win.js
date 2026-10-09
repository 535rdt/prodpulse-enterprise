const builder = require("electron-builder");
const Platform = builder.Platform;

builder.build({
  targets: Platform.WINDOWS.createTarget(["nsis", "appx"]),
  config: {
    appId: "com.production.app",
    productName: "Production App",
    directories: {
      output: "dist_electron"
    },
    asar: false,
    appx: {
      identityName: "ProductionApp",
      publisher: "CN=Antigravity",
      publisherDisplayName: "Antigravity"
    },
    files: [
      "dist/**/*",
      "electron/**/*"
    ]
  }
})
  .then(() => {
    console.log("Build complete!");
    // Copy the files out
    const fs = require('fs');
    const path = require('path');
    const dest = path.resolve('..');
    
    const exes = fs.readdirSync('dist_electron').filter(f => f.endsWith('.exe'));
    if (exes.length > 0) fs.copyFileSync(path.join('dist_electron', exes[0]), path.join(dest, 'ProductionApp.exe'));

    const msix = fs.readdirSync('dist_electron').filter(f => f.endsWith('.msix') || f.endsWith('.appx'));
    if (msix.length > 0) {
      const msixDest = path.join(dest, 'ProductionApp.msix');
      fs.copyFileSync(path.join('dist_electron', msix[0]), msixDest);

      // Auto-sign the MSIX package if certificate and signtool exist
      const signtool = path.join(dest, 'certs', 'signtool.exe');
      const pfx = path.join(dest, 'certs', 'antigravity.pfx');
      if (fs.existsSync(signtool) && fs.existsSync(pfx)) {
        try {
          const { execSync } = require('child_process');
          execSync(`"${signtool}" sign /fd SHA256 /f "${pfx}" /p "password123" "${msixDest}"`, { stdio: 'inherit' });
          console.log("Successfully signed ProductionApp.msix with Antigravity certificate!");
        } catch (err) {
          console.warn("Could not sign MSIX:", err.message);
        }
      }
    }

    console.log("Copied builds to root.");
  })
  .catch((error) => {
    console.error("Build failed:", error);
    process.exit(1);
  });
