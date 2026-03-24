const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OPTIONS = require('../../constants/OPTIONS');

/**
 * Extracts image URLs from og:image and twitter:image meta tags in HTML files,
 * then downloads any that are missing from the static output.
 */
const fetchMetaImagesHelper = (absoluteStaticPath) => {
  const imageUrls = new Set();

  const collectFromDir = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFromDir(fullPath);
      } else if (entry.name.endsWith('.html')) {
        try {
          const html = fs.readFileSync(fullPath, 'utf8');
          const metaRegex = /<meta\s+(?:[^>]*?\s+)?(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*?\s+content\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi;
          const metaRegexAlt = /<meta\s+(?:[^>]*?\s+)?content\s*=\s*["']([^"']+)["'][^>]*?\s+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*?\/?>/gi;
          let match;
          while ((match = metaRegex.exec(html)) !== null) {
            imageUrls.add(match[1]);
          }
          while ((match = metaRegexAlt.exec(html)) !== null) {
            imageUrls.add(match[1]);
          }
        } catch (e) {
          // skip unreadable files
        }
      } else if (entry.name.endsWith('.xml')) {
        // Also check RSS/Atom feeds for image references
        try {
          const xml = fs.readFileSync(fullPath, 'utf8');
          const mediaRegex = /<media:content\s+[^>]*?url\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi;
          const imageTagRegex = /<image>\s*<url>([^<]+)<\/url>/gi;
          let match;
          while ((match = mediaRegex.exec(xml)) !== null) {
            imageUrls.add(match[1]);
          }
          while ((match = imageTagRegex.exec(xml)) !== null) {
            imageUrls.add(match[1]);
          }
        } catch (e) {
          // skip unreadable files
        }
      }
    }
  };

  collectFromDir(absoluteStaticPath);

  if (imageUrls.size === 0) {
    console.log('No og:image/twitter:image URLs found to fetch.');
    return;
  }

  console.log(`Found ${imageUrls.size} meta image URL(s) to check.`);

  const sourceDomain = OPTIONS.SOURCE_DOMAIN;

  for (const imageUrl of imageUrls) {
    // Only download images hosted on the source domain
    if (!imageUrl.startsWith(sourceDomain) && !imageUrl.startsWith('/')) {
      continue;
    }

    const relativePath = imageUrl.startsWith('/')
      ? imageUrl
      : imageUrl.replace(sourceDomain, '');

    const localPath = path.join(absoluteStaticPath, relativePath);

    if (fs.existsSync(localPath)) {
      continue;
    }

    const fullUrl = imageUrl.startsWith('/')
      ? `${sourceDomain}${imageUrl}`
      : imageUrl;

    // Ensure target directory exists
    const targetDir = path.dirname(localPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      console.log(`Fetching meta image: ${fullUrl}`);
      execSync(
        `wget -q --no-host-directories --force-directories --directory-prefix ${OPTIONS.STATIC_DIRECTORY} ${fullUrl}`,
        { stdio: 'inherit' },
      );
    } catch (e) {
      console.log(`WARNING: Failed to fetch meta image: ${fullUrl}`);
    }
  }
};

module.exports = fetchMetaImagesHelper;
