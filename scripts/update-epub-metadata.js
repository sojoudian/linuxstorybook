#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Metadata to add
const metadata = {
  title: 'فقط برای تفریح',
  author: 'لینوس توروالدز و دیوید دیاموند',
  translator: 'جادی میرمیرانی',
  language: 'fa',
  publisher: 'LinuxStory.ir',
  rights: 'CC0 1.0 Universal',
  description: 'داستان زندگی لینوس توروالدز، خالق لینوکس',
  subject: 'کامپیوتر، برنامه‌نویسی، لینوکس، نرم‌افزار آزاد'
};

async function updateEpubMetadata() {
  console.log('📚 Updating EPUB metadata...\n');
  
  const inputFile = path.join(__dirname, '..', 'src', 'static', 'justforfun_persian_rtl.epub');
  const outputFile = path.join(__dirname, '..', 'src', 'static', 'justforfun_persian_rtl_updated.epub');
  const tempDir = path.join(__dirname, '..', 'temp-epub');
  
  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error('❌ Input file not found:', inputFile);
    process.exit(1);
  }
  
  try {
    // Create temp directory
    console.log('📁 Creating temporary directory...');
    if (fs.existsSync(tempDir)) {
      await execPromise(`rm -rf "${tempDir}"`);
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Extract EPUB
    console.log('📦 Extracting EPUB...');
    await execPromise(`unzip -q "${inputFile}" -d "${tempDir}"`);
    
    // Find and read the OPF file
    console.log('🔍 Finding OPF file...');
    let opfPath = null;
    
    // Check common locations
    const possiblePaths = [
      path.join(tempDir, 'content.opf'),
      path.join(tempDir, 'OEBPS', 'content.opf'),
      path.join(tempDir, 'OPS', 'content.opf')
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        opfPath = p;
        break;
      }
    }
    
    // If not found in common locations, search for it
    if (!opfPath) {
      const findResult = await execPromise(`find "${tempDir}" -name "*.opf" -type f`);
      const opfFiles = findResult.stdout.trim().split('\n').filter(f => f);
      if (opfFiles.length > 0) {
        opfPath = opfFiles[0];
      }
    }
    
    if (!opfPath) {
      console.error('❌ Could not find OPF file in EPUB');
      process.exit(1);
    }
    
    console.log('📝 Found OPF at:', opfPath);
    
    // Read OPF content
    let opfContent = fs.readFileSync(opfPath, 'utf8');
    
    // Update or add metadata
    console.log('✏️  Updating metadata...');
    
    // Helper function to update or add metadata
    function updateMetadataTag(content, namespace, tag, value, attributes = '') {
      const fullTag = namespace ? `${namespace}:${tag}` : tag;
      const regex = new RegExp(`<${fullTag}[^>]*>.*?<\/${fullTag}>`, 'gi');
      const newTag = `<${fullTag}${attributes}>${value}</${fullTag}>`;
      
      if (regex.test(content)) {
        // Update existing tag
        return content.replace(regex, newTag);
      } else {
        // Add new tag before </metadata>
        return content.replace(/<\/metadata>/, `    ${newTag}\n  </metadata>`);
      }
    }
    
    // Update metadata fields
    opfContent = updateMetadataTag(opfContent, 'dc', 'title', metadata.title);
    opfContent = updateMetadataTag(opfContent, 'dc', 'creator', metadata.author);
    opfContent = updateMetadataTag(opfContent, 'dc', 'language', metadata.language);
    opfContent = updateMetadataTag(opfContent, 'dc', 'publisher', metadata.publisher);
    opfContent = updateMetadataTag(opfContent, 'dc', 'rights', metadata.rights);
    opfContent = updateMetadataTag(opfContent, 'dc', 'description', metadata.description);
    opfContent = updateMetadataTag(opfContent, 'dc', 'subject', metadata.subject);
    
    // Add translator as contributor
    if (!opfContent.includes('ترجمه:')) {
      opfContent = opfContent.replace(
        /<\/metadata>/,
        `    <dc:contributor>ترجمه: ${metadata.translator}</dc:contributor>\n  </metadata>`
      );
    }
    
    // Add date if not present
    const today = new Date().toISOString().split('T')[0];
    if (!opfContent.includes('<dc:date>')) {
      opfContent = opfContent.replace(
        /<\/metadata>/,
        `    <dc:date>${today}</dc:date>\n  </metadata>`
      );
    }
    
    // Write updated OPF
    fs.writeFileSync(opfPath, opfContent, 'utf8');
    console.log('✅ Metadata updated successfully');
    
    // Re-create EPUB
    console.log('📦 Creating updated EPUB...');
    
    // First, create the mimetype file if it doesn't exist
    const mimetypePath = path.join(tempDir, 'mimetype');
    if (!fs.existsSync(mimetypePath)) {
      fs.writeFileSync(mimetypePath, 'application/epub+zip', { encoding: 'utf8' });
    }
    
    // Create the EPUB with proper structure
    const files = fs.readdirSync(tempDir);
    let zipCmd;
    
    if (files.includes('mimetype')) {
      // Standard EPUB creation with uncompressed mimetype
      zipCmd = `cd "${tempDir}" && zip -X0 "${outputFile}" mimetype && zip -rg "${outputFile}" * -x mimetype`;
    } else {
      // Fallback if no mimetype
      zipCmd = `cd "${tempDir}" && zip -r "${outputFile}" *`;
    }
    
    await execPromise(zipCmd);
    
    // Clean up
    console.log('🧹 Cleaning up...');
    await execPromise(`rm -rf "${tempDir}"`);
    
    // Get file sizes
    const originalSize = fs.statSync(inputFile).size;
    const newSize = fs.statSync(outputFile).size;
    
    console.log('\n✅ Success! Updated EPUB created:');
    console.log(`📄 Original: ${path.basename(inputFile)} (${(originalSize / 1024).toFixed(2)} KB)`);
    console.log(`📄 Updated: ${path.basename(outputFile)} (${(newSize / 1024).toFixed(2)} KB)`);
    console.log('\n📖 Metadata added:');
    console.log(`   Title: ${metadata.title}`);
    console.log(`   Author: ${metadata.author}`);
    console.log(`   Translator: ${metadata.translator}`);
    console.log(`   Language: ${metadata.language}`);
    console.log(`   Publisher: ${metadata.publisher}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      await execPromise(`rm -rf "${tempDir}"`);
    }
    process.exit(1);
  }
}

// Run the update
updateEpubMetadata();