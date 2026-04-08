import * as OpenCC from 'opencc-js';

// Initialize the converter once to improve performance
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

export function convertToTraditional(text: string): string {
  return converter(text);
}

export function replaceQuotes(text: string): string {
  return text
    .replace(/“/g, '「')
    .replace(/”/g, '」')
    .replace(/‘/g, '『')
    .replace(/’/g, '』');
}

export function processText(text: string): string {
  const traditionalText = convertToTraditional(text);
  return replaceQuotes(traditionalText);
}
