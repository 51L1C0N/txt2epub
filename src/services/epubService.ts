import JSZip from 'jszip';
import { v5 as uuidv5 } from 'uuid';
import epubCss from '../assets/epub-style.css?raw';
import { replaceQuotes, convertToTraditional } from '../utils/textConverter';

export interface Chapter {
  title: string;
  content: string;
}

export interface EpubOptions {
  title: string;
  author: string;
  convertToTraditional: boolean;
  koboOptimization: boolean;
}

// Helper to sanitize filenames for cross-platform compatibility
function sanitizeFilename(name: string): string {
  // Remove invalid characters for Windows/macOS/Linux: \ / : * ? " < > |
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'ebook';
}

// Helper to ensure valid XML IDs
function toXmlId(name: string, index: number): string {
  return `id_${index}`;
}

export async function generateEpub(fileContent: string, options: EpubOptions): Promise<Blob> {
  let content = fileContent;
  let title = options.title || 'Untitled';
  const author = options.author || 'Unknown';

  // 1. Chinese Conversion (Optional)
  if (options.convertToTraditional) {
    content = convertToTraditional(content);
    title = convertToTraditional(title);
  }

  // 2. Quote Replacement
  content = replaceQuotes(content);

  // 3. Chapter Parsing
  const chapters = parseChapters(content, title);

  // 4. Build EPUB
  const zip = new JSZip();
  const bookUuid = uuidv5(title, uuidv5.DNS);
  const modifiedDate = new Date().toISOString().split('.')[0] + 'Z';

  // mimetype MUST be first, uncompressed, and exactly 20 bytes
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // OEBPS/style.css
  zip.file('OEBPS/style.css', epubCss);

  const manifest: string[] = [];
  const spine: string[] = [];
  const toc: string[] = [];

  // OEBPS/chapters
  chapters.forEach((chapter, i) => {
    const filename = `chapter_${i}.xhtml`;
    const id = toXmlId('ch', i);
    
    let paras = chapter.content
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (options.koboOptimization) {
      paras = paras.map((p, pIdx) => {
        const segments = p.split(/([。！？；…]+)/).filter(s => s.length > 0);
        let processedP = '';
        for (let sIdx = 0; sIdx < segments.length; sIdx++) {
          const text = segments[sIdx];
          const spanId = `kobo.${i + 1}.${pIdx + 1}.${Math.floor(sIdx / 2) + 1}`;
          if (sIdx % 2 === 0) {
            const punctuation = segments[sIdx + 1] || '';
            processedP += `<span class="koboSpan" id="${spanId}">${escapeHtml(text + punctuation)}</span>`;
            sIdx++;
          } else {
            processedP += escapeHtml(text);
          }
        }
        return `<p>${processedP || escapeHtml(p)}</p>`;
      });
    } else {
      paras = paras.map(p => `<p>${escapeHtml(p)}</p>`);
    }

    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-TW" lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="chapter">
    <h1>${escapeHtml(chapter.title)}</h1>
    ${paras.join('\n')}
  </section>
</body>
</html>`;

    zip.file(`OEBPS/${filename}`, xhtml);
    manifest.push(`<item id="${id}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
    toc.push(`<li><a href="${filename}">${escapeHtml(chapter.title)}</a></li>`);
  });

  // OEBPS/content.opf (EPUB 3.3 compliant)
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" prefix="rendition: http://www.idpf.org/2007/opf/prediction/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${bookUuid}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>zh-TW</dc:language>
    <meta property="dcterms:modified">${modifiedDate}</meta>
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifest.join('\n    ')}
  </manifest>
  <spine page-progression-direction="rtl">
    ${spine.join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', opf);

  // OEBPS/nav.xhtml
  const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-TW" lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${toc.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', nav);

  return await zip.generateAsync({ 
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE'
  });
}

export { sanitizeFilename };

export async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  
  // Encodings to try, in order of priority
  const encodings = ['utf-8', 'gb18030', 'big5', 'utf-16le', 'utf-16be'];
  
  for (const enc of encodings) {
    try {
      const decoder = new TextDecoder(enc, { fatal: true });
      return decoder.decode(buffer);
    } catch (e) {
      continue;
    }
  }
  
  // Last resort: non-fatal UTF-8
  return new TextDecoder('utf-8').decode(buffer);
}

function parseChapters(content: string, bookTitle: string): Chapter[] {
  // Normalize line endings and quotes
  let processedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // The Python script joins stripped lines with \n
  const lines = processedContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const fullText = lines.join('\n');

  // Chapter pattern with capturing group for split
  const chapterPattern = /^\s*(第[0-9一二三四五六七八九十百千萬]+[章回卷節].*|楔子.*|序章.*|番外.*|最終回.*)\s*$/m;
  
  // Using split with capturing group returns [intro, title1, content1, title2, content2, ...]
  const parts = fullText.split(chapterPattern);
  const chapters: Chapter[] = [];
  
  if (parts[0].trim()) {
    chapters.push({ title: 'Preface', content: parts[0].trim() });
  }
  
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i += 2) {
      const title = parts[i].trim();
      const content = parts[i + 1]?.trim() || '';
      if (title) {
        chapters.push({ title, content });
      }
    }
  } else if (chapters.length === 0) {
    // No chapters found, use book title
    chapters.push({ title: bookTitle, content: fullText });
  }

  return chapters;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
