import fs from 'fs';
import path from 'path';

let content = fs.readFileSync(path.join(process.cwd(), 'client/src/pages/configuracoes.tsx'), 'utf-8');

const components = [
  'AISection',
  'TVSection',
  'EquipesSection',
  'MetasSection',
  'PermissoesSection'
];

function getFunctionBounds(content: string, funcName: string) {
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
  
  return { start: startIndex, end: endIndex };
}

for (const comp of components) {
  const bounds = getFunctionBounds(content, comp);
  if (bounds && bounds.end !== -1) {
    content = content.substring(0, bounds.start) + content.substring(bounds.end);
    console.log(`Removed ${comp}`);
  }
}

const importsToAdd = `
import { AISection } from '@/components/settings/aisection';
import { TVSection } from '@/components/settings/tvsection';
import { EquipesSection } from '@/components/settings/equipessection';
import { MetasSection } from '@/components/settings/metassection';
import { PermissoesSection } from '@/components/settings/permissoessection';
`;

// Add imports after the last import line
const lines = content.split('\n');
let lastImportIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ')) {
    lastImportIdx = i;
  }
}

if (lastImportIdx !== -1) {
  lines.splice(lastImportIdx + 1, 0, importsToAdd);
}

fs.writeFileSync(path.join(process.cwd(), 'client/src/pages/configuracoes.tsx'), lines.join('\n'));
console.log('Done refactoring!');
