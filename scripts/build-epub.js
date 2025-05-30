#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// EPUB metadata for Apple Books
const metadata = {
  title: 'فقط برای تفریح',
  author: 'لینوس توروالدز و دیوید دیاموند',
  translator: 'جادی میرمیرانی',
  language: 'fa',
  publisher: 'LinuxStory.ir',
  rights: 'CC0 1.0 Universal',
  description: 'داستان زندگی لینوس توروالدز، خالق لینوکس',
  subject: 'کامپیوتر، برنامه‌نویسی، لینوکس، نرم‌افزار آزاد',
  date: new Date().toISOString().split('T')[0],
  identifier: 'linuxstory-persian-' + Date.now()
};

// Ensure output directory exists
const outputDir = path.join(__dirname, '..', 'out', 'epub-build');
const staticDir = path.join(__dirname, '..', 'src', 'static');

async function createDirectories() {
  const dirs = [
    outputDir,
    path.join(outputDir, 'META-INF'),
    path.join(outputDir, 'OEBPS'),
    path.join(outputDir, 'OEBPS', 'css'),
    path.join(outputDir, 'OEBPS', 'chapters')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Create mimetype file (must be first file in ZIP, uncompressed)
function createMimetype() {
  fs.writeFileSync(
    path.join(outputDir, 'mimetype'),
    'application/epub+zip',
    { encoding: 'utf8', flag: 'w' }
  );
}

// Create META-INF/container.xml
function createContainer() {
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  
  fs.writeFileSync(
    path.join(outputDir, 'META-INF', 'container.xml'),
    containerXml
  );
}

// Create Apple Books display options
function createDisplayOptions() {
  const displayOptions = `<?xml version="1.0" encoding="UTF-8"?>
<display_options>
  <platform name="*">
    <option name="specified-fonts">true</option>
    <option name="page-progression-direction">rtl</option>
  </platform>
</display_options>`;
  
  fs.writeFileSync(
    path.join(outputDir, 'META-INF', 'com.apple.ibooks.display-options.xml'),
    displayOptions
  );
}

// Create CSS for RTL and Apple Books optimization
function createCSS() {
  const css = `/* Apple Books optimized CSS for Persian text */
@charset "UTF-8";

/* Import Vazirmatn font */
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100;200;300;400;500;600;700;800;900&display=swap');

/* RTL support */
html {
  direction: rtl;
  text-align: right;
}

body {
  font-family: 'Vazirmatn', -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-size: 1em;
  line-height: 1.8;
  margin: 0;
  padding: 0;
  direction: rtl;
  text-align: right;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-family: 'Vazirmatn', -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-weight: 700;
  margin-top: 1em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
  direction: rtl;
  text-align: right;
}

h1 {
  font-size: 1.8em;
  text-align: center;
  margin-top: 2em;
  margin-bottom: 1em;
}

h2 {
  font-size: 1.4em;
}

h3 {
  font-size: 1.2em;
}

/* Paragraphs */
p {
  margin: 0.5em 0 1em 0;
  text-indent: 0;
  direction: rtl;
  text-align: right;
}

/* Lists */
ul, ol {
  margin: 1em 0;
  padding-right: 2em;
  padding-left: 0;
  direction: rtl;
}

li {
  margin: 0.5em 0;
  direction: rtl;
}

/* Links */
a {
  color: #007AFF;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Code blocks */
pre, code {
  font-family: "SF Mono", Monaco, Consolas, monospace;
  font-size: 0.9em;
  direction: ltr;
  text-align: left;
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

pre {
  padding: 1em;
  overflow-x: auto;
  margin: 1em 0;
}

/* Blockquotes */
blockquote {
  margin: 1em 0;
  padding-right: 1em;
  padding-left: 0;
  border-right: 3px solid #ccc;
  border-left: none;
  font-style: italic;
  direction: rtl;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}

/* Page breaks */
.chapter {
  page-break-before: always;
}

/* Horizontal rules */
hr {
  margin: 2em 0;
  border: none;
  border-top: 1px solid #ccc;
}

/* Apple Books specific optimizations */
@media screen and (min-device-width: 768px) {
  body {
    font-size: 1.1em;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #1c1c1e;
    color: #ffffff;
  }
  
  pre, code {
    background-color: #2c2c2e;
    color: #ffffff;
  }
  
  a {
    color: #0A84FF;
  }
  
  blockquote {
    border-right-color: #48484a;
  }
  
  hr {
    border-top-color: #48484a;
  }
}`;
  
  fs.writeFileSync(
    path.join(outputDir, 'OEBPS', 'css', 'style.css'),
    css
  );
}

// Generate OPF file (EPUB package document)
async function createOPF(chapters) {
  let manifest = '';
  let spine = '';
  
  // Add CSS to manifest
  manifest += '    <item id="css" href="css/style.css" media-type="text/css"/>\n';
  
  // Add chapters to manifest and spine
  chapters.forEach((chapter, index) => {
    const id = `chapter${index + 1}`;
    manifest += `    <item id="${id}" href="chapters/${chapter.filename}" media-type="application/xhtml+xml"/>\n`;
    spine += `    <itemref idref="${id}"/>\n`;
  });
  
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${metadata.identifier}</dc:identifier>
    <dc:title>${metadata.title}</dc:title>
    <dc:creator>${metadata.author}</dc:creator>
    <dc:contributor>ترجمه: ${metadata.translator}</dc:contributor>
    <dc:language>${metadata.language}</dc:language>
    <dc:publisher>${metadata.publisher}</dc:publisher>
    <dc:rights>${metadata.rights}</dc:rights>
    <dc:description>${metadata.description}</dc:description>
    <dc:subject>${metadata.subject}</dc:subject>
    <dc:date>${metadata.date}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
    <meta name="apple:specified-fonts" content="true"/>
    <meta name="ibooks:version" content="1.0"/>
  </metadata>
  
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifest}  </manifest>
  
  <spine page-progression-direction="rtl">
    <itemref idref="nav" linear="no"/>
${spine}  </spine>
</package>`;
  
  fs.writeFileSync(
    path.join(outputDir, 'OEBPS', 'content.opf'),
    opf
  );
}

// Create navigation document (EPUB 3 requirement)
function createNav(chapters) {
  let navItems = '';
  let currentChapter = '';
  let chapterItems = '';
  
  chapters.forEach((chapter, index) => {
    if (chapter.chapter !== currentChapter) {
      if (currentChapter !== '') {
        navItems += `      <li><a href="chapters/${chapters[index-1].filename}">${currentChapter}</a>
        <ol>
${chapterItems}        </ol>
      </li>\n`;
      }
      currentChapter = chapter.chapter;
      chapterItems = '';
    }
    chapterItems += `          <li><a href="chapters/${chapter.filename}">${chapter.title}</a></li>\n`;
  });
  
  // Add last chapter
  if (currentChapter !== '') {
    navItems += `      <li><a href="chapters/${chapters[chapters.length-1].filename}">${currentChapter}</a>
        <ol>
${chapterItems}        </ol>
      </li>\n`;
  }
  
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>فهرست</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <nav epub:type="toc">
    <h1>فهرست</h1>
    <ol>
${navItems}    </ol>
  </nav>
</body>
</html>`;
  
  fs.writeFileSync(
    path.join(outputDir, 'OEBPS', 'nav.xhtml'),
    nav
  );
}

// Convert HTML content to valid XHTML for EPUB
function htmlToXHTML(html, title) {
  // Remove any DOCTYPE if present
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '');
  
  // Ensure self-closing tags
  html = html.replace(/<br>/gi, '<br/>');
  html = html.replace(/<hr>/gi, '<hr/>');
  html = html.replace(/<img([^>]*?)>/gi, '<img$1/>');
  html = html.replace(/<meta([^>]*?)>/gi, '<meta$1/>');
  html = html.replace(/<link([^>]*?)>/gi, '<link$1/>');
  
  // Fix entities
  html = html.replace(/&nbsp;/gi, '&#160;');
  html = html.replace(/&copy;/gi, '&#169;');
  
  // Wrap in proper XHTML structure
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="../css/style.css"/>
</head>
<body>
  <div class="chapter">
${html}
  </div>
</body>
</html>`;
  
  return xhtml;
}

// Main build function
async function buildEPUB() {
  console.log('🚀 Starting Apple Books EPUB build...\n');
  
  // Create directory structure
  console.log('📁 Creating directory structure...');
  await createDirectories();
  
  // Check if all.html exists, generate if not
  const allHtmlPath = path.join(__dirname, '..', 'out', 'all.html');
  if (!fs.existsSync(allHtmlPath)) {
    console.log('🔨 Generating static site with DocPad...');
    try {
      await execPromise('npm test');
    } catch (error) {
      console.error('❌ Error generating site:', error.message);
      console.log('⚠️  Please ensure DocPad can run or that out/all.html exists');
      process.exit(1);
    }
  } else {
    console.log('✅ Using existing generated site (out/all.html)');
  }
  
  // Create EPUB structure files
  console.log('📝 Creating EPUB metadata files...');
  createMimetype();
  createContainer();
  createDisplayOptions();
  createCSS();
  
  // Read the generated all.html file
  console.log('📖 Processing chapters...');
  
  const allHtml = fs.readFileSync(allHtmlPath, 'utf8');
  
  // Extract chapters from the HTML
  const chapters = [];
  let chapterIndex = 0;
  
  // Remove the header/navigation part and find main content
  const bodyMatch = allHtml.match(/<body[^>]*>([\s\S]*?)<\/body\s*>/);
  if (!bodyMatch) {
    console.error('❌ Could not find body content');
    process.exit(1);
  }
  
  const bodyContent = bodyMatch[1];
  
  // Split content by h1 tags (chapter headers)
  const parts = bodyContent.split(/<h1 >/);
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    
    // Extract chapter name
    const chapterNameMatch = part.match(/^([^<]+)<\/h1[^>]*>/);
    if (!chapterNameMatch) continue;
    
    const chapterName = chapterNameMatch[1].trim();
    const remainingContent = part.substring(chapterNameMatch[0].length);
    
    // Find all h2 sections within this chapter
    const h2Parts = remainingContent.split(/<h2 >/);
    
    for (let j = 1; j < h2Parts.length; j++) {
      const h2Part = h2Parts[j];
      
      // Extract title
      const titleMatch = h2Part.match(/^([^<]+)<\/h2[^>]*>/);
      if (!titleMatch) continue;
      
      const title = titleMatch[1].trim();
      let content = h2Part.substring(titleMatch[0].length);
      
      // Find where this section ends (next h2, h1, or the hr separator)
      const endMatch = content.match(/<h2 >|<h1 >|<hr><b>فقط برای تفریح/);
      if (endMatch) {
        content = content.substring(0, endMatch.index);
      }
      
      // Clean up the content
      content = content.trim();
      
      if (content) {
        chapterIndex++;
        const filename = `chapter${chapterIndex}.xhtml`;
        
        chapters.push({
          chapter: chapterName,
          title,
          filename,
          content
        });
        
        // Create XHTML file for chapter
        const xhtmlContent = htmlToXHTML(`<h1>${chapterName}</h1>\n<h2>${title}</h2>\n${content}`, title);
        fs.writeFileSync(
          path.join(outputDir, 'OEBPS', 'chapters', filename),
          xhtmlContent
        );
      }
    }
  }
  
  console.log(`✅ Processed ${chapters.length} chapters`);
  
  // Create OPF and navigation
  console.log('📋 Creating package files...');
  await createOPF(chapters);
  createNav(chapters);
  
  // Create EPUB file
  console.log('📦 Creating EPUB file...');
  const epubFilename = `justforfun_persian_apple_${new Date().toISOString().split('T')[0]}.epub`;
  const epubPath = path.join(staticDir, epubFilename);
  
  // Use native zip command (available on macOS)
  const zipCmd = `cd "${outputDir}" && zip -X0 "${epubPath}" mimetype && zip -rg "${epubPath}" META-INF OEBPS`;
  
  try {
    await execPromise(zipCmd);
    console.log(`\n✅ Successfully created: ${epubFilename}`);
    console.log(`📍 Location: ${epubPath}`);
    
    // Get file size
    const stats = fs.statSync(epubPath);
    console.log(`📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Cleanup build directory
    await execPromise(`rm -rf "${outputDir}"`);
    console.log('\n🎉 Build complete! The EPUB is optimized for Apple Books.');
    console.log('\n📱 To test on Apple Books:');
    console.log('   1. AirDrop the file to your iPhone/iPad');
    console.log('   2. Or double-click to open in Books on macOS');
    
  } catch (error) {
    console.error('❌ Error creating EPUB:', error.message);
    process.exit(1);
  }
}

// Run the build
buildEPUB().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});