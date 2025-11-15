export function isValidXML(input: string): boolean {
  if (!input.length || /[\\&]/.test(input)) return false;

  const stack: string[] = [];
  let position = 0;

  while (position < input.length) {
    const nextTag = input.indexOf('<', position);
    if (nextTag === -1) break;
    position = nextTag + 1;

    const isClosing = input[position] === '/';
    if (isClosing) position++;

    const tagEnd = input.indexOf('>', position);
    if (tagEnd === -1 || position === tagEnd) return false;
    const tagName = input.slice(position, tagEnd);
    position = tagEnd + 1;

    if (isClosing) {
      if (!stack.length || stack.pop() !== tagName) return false;
    } else {
      stack.push(tagName);
    }
  }

  return stack.length === 0;
}
