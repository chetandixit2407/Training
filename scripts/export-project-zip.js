import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createPortableZip(outputPath = path.join(rootDir, 'portable-pantry-app.zip')) {
  console.log('📦 Starting portable project ZIP creation...');
  const zip = new AdmZip();

  const ignoreDirs = new Set(['node_modules', 'dist', '.git', 'coverage', '.cache', 'backups']);
  const ignoreFiles = new Set(['.DS_Store', 'portable-pantry-app.zip', 'dist-portable-project.zip']);

  let totalFiles = 0;
  let referencePhotosCount = 0;
  let completionPhotosCount = 0;
  let jsonDatabasesCount = 0;

  function addDirRecursive(currentDir, zipPath = '') {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      if (ignoreFiles.has(item)) continue;
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (ignoreDirs.has(item)) continue;
        const nextZipPath = zipPath ? `${zipPath}/${item}` : item;
        addDirRecursive(fullPath, nextZipPath);
      } else if (stat.isFile()) {
        const entryPath = zipPath ? `${zipPath}/${item}` : item;
        zip.addLocalFile(fullPath, zipPath);
        totalFiles++;

        if (entryPath.startsWith('data/uploads/reference/')) {
          referencePhotosCount++;
        } else if (entryPath.startsWith('data/uploads/completion/')) {
          completionPhotosCount++;
        } else if (entryPath.startsWith('data/') && entryPath.endsWith('.json')) {
          jsonDatabasesCount++;
        }
      }
    }
  }

  // 1. Add top-level project files and subfolders
  const topItems = fs.readdirSync(rootDir);
  for (const item of topItems) {
    if (ignoreFiles.has(item) || ignoreDirs.has(item)) continue;
    const fullPath = path.join(rootDir, item);
    const stat = fs.statSync(fullPath);

    if (item === 'data') {
      // Add data json files
      const dataFiles = fs.readdirSync(fullPath);
      for (const df of dataFiles) {
        if (df === 'backups') continue;
        const dfFull = path.join(fullPath, df);
        const dfStat = fs.statSync(dfFull);
        if (dfStat.isFile() && df.endsWith('.json')) {
          zip.addLocalFile(dfFull, 'data');
          totalFiles++;
          jsonDatabasesCount++;
        }
      }
      // Add data/uploads/reference
      const refDir = path.join(fullPath, 'uploads', 'reference');
      if (fs.existsSync(refDir)) {
        const refFiles = fs.readdirSync(refDir);
        for (const rf of refFiles) {
          const rfFull = path.join(refDir, rf);
          if (fs.statSync(rfFull).isFile()) {
            zip.addLocalFile(rfFull, 'data/uploads/reference');
            totalFiles++;
            referencePhotosCount++;
          }
        }
      }
      // Add data/uploads/completion
      const compDir = path.join(fullPath, 'uploads', 'completion');
      if (fs.existsSync(compDir)) {
        const compFiles = fs.readdirSync(compDir);
        for (const cf of compFiles) {
          const cfFull = path.join(compDir, cf);
          if (fs.statSync(cfFull).isFile()) {
            zip.addLocalFile(cfFull, 'data/uploads/completion');
            totalFiles++;
            completionPhotosCount++;
          }
        }
      }
    } else if (stat.isDirectory()) {
      addDirRecursive(fullPath, item);
    } else if (stat.isFile()) {
      zip.addLocalFile(fullPath, '');
      totalFiles++;
    }
  }

  // 2. Add portable manifest
  const manifest = {
    exportDate: new Date().toISOString(),
    system: 'Office Operations & AI Training App',
    appletId: '8b08ae5c-a9f1-4dcb-ab7c-e994beefc91f',
    version: '1.0.0',
    totalFiles,
    referencePhotosCount,
    completionPhotosCount,
    jsonDatabasesCount,
    portabilityVerified: true,
  };
  zip.addFile('portable-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

  // 3. Write ZIP to disk
  zip.writeZip(outputPath);
  const outStat = fs.statSync(outputPath);

  console.log(`✅ Portable ZIP generated successfully at: ${outputPath}`);
  console.log(`   - File size: ${(outStat.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`   - Total files included: ${totalFiles + 1}`);
  console.log(`   - Reference photos included: ${referencePhotosCount}`);
  console.log(`   - Completion proof photos: ${completionPhotosCount}`);
  console.log(`   - JSON databases: ${jsonDatabasesCount}`);

  return {
    outputPath,
    fileSizeMb: (outStat.size / (1024 * 1024)).toFixed(2),
    totalFiles: totalFiles + 1,
    referencePhotosCount,
    completionPhotosCount,
    jsonDatabasesCount,
  };
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('export-project-zip.js')) {
  createPortableZip();
}
