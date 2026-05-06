import fs from 'fs';
import path from 'path';

const fileContent = fs.readFileSync(path.join(process.cwd(), 'client/src/pages/configuracoes.tsx'), 'utf-8');

const components = [
  'EquipesSection',
  'MetasSection'
];

function extractFunction(content: string, funcName: string) {
  // Use a simpler regex that matches anything until the opening bracket {
  const startRegex = new RegExp(`function ${funcName}\\s*\\([\\s\\S]*?\\)\\s*\\{`);
  const match = content.match(startRegex);
  if (!match) return null;
  
  const startIndex = match.index;
  let bracketCount = 0;
  let endIndex = -1;
  let inString = false;
  let stringChar = '';
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const prevChar = content[i-1];
    
    if ((char === '"' || char === "'" || char === '\`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '{') bracketCount++;
      if (char === '}') {
        bracketCount--;
        if (bracketCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
  }
  
  if (endIndex === -1) return null;
  return content.substring(startIndex, endIndex);
}

const dir = path.join(process.cwd(), 'client/src/components/settings');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const importLines = fileContent.split('\n').filter(line => line.startsWith('import '));
const importsStr = importLines.join('\n');

for (const comp of components) {
  const code = extractFunction(fileContent, comp);
  if (code) {
    const exportedCode = code.replace(`function ${comp}`, `export function ${comp}`);
    const finalCode = `${importsStr}\n\n${exportedCode}\n`;
    fs.writeFileSync(path.join(dir, `${comp.toLowerCase()}.tsx`), finalCode);
    console.log(`Extracted ${comp}`);
  } else {
    console.log(`Failed to extract ${comp}`);
  }
}
