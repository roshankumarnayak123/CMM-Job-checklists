const fs = require('fs');
const b64 = fs.readFileSync('C:/Users/rosha/.gemini/antigravity-ide/brain/3e4afb21-131c-4e51-9125-0861d815ead0/.user_uploaded/media_1786987359165.png').toString('base64');
const dataUri = 'data:image/png;base64,' + b64;
const targetFile = 'C:/Users/rosha/Downloads/CMM Job checklists/src/utils/pdfGenerator.js';
let content = fs.readFileSync(targetFile, 'utf8');
content = content.replace(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 160 40" width="130" height="36" style="margin-top: 4px;">[\s\S]*?<\/svg>/m, 
  '<img src="' + dataUri + '" alt="Tata Steel" style="height: 52px; object-fit: contain; margin-right: 4px;" />'
);
fs.writeFileSync(targetFile, content);
console.log('Done replacing');
