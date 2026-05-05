import { readFileSync, globSync } from 'fs';
import { isValidReactTransString } from './lib/validator.ts';

function processValue(value: any, path = ''): Array<{ path: string; value: string; valid: boolean }> {
  if (typeof value === 'string') {
    return [{ path, value, valid: isValidReactTransString(value) }];
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => processValue(val, path ? `${path}.${key}` : key))
      .flat();
  }
  return [];
}

const inputPath = process.argv[2] || process.env.INPUT_PATH || process.cwd();
const files = globSync('**/*.json', { cwd: inputPath });

let hasErrors = false;
for (const file of files) {
  try {
    const content = readFileSync(`${inputPath}/${file}`, 'utf8');
    const parsed = JSON.parse(content);
    const results = processValue(parsed);

    for (const result of results) {
      if (!result.valid) {
        console.log(`${file}: ${result.path}: "${result.value}" is invalid`);
        hasErrors = true;
      }
    }
  } catch (err) {
    console.log(`${file}: ${err}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}
