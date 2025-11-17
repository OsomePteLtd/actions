import { isValidReactTransString } from './validator.ts';

describe('isValidReactTransString', () => {
  describe('valid cases', () => {
    it.each([
      ['plain text without tags', 'hello world'],
      ['bare ampersand character', 'hello & world'],
      ['simple valid tag', '<b>bold</b>'],
      ['text with valid tags', 'hello <b>world</b>'],
      ['properly nested tags', '<outer><inner>nested</inner></outer>'],
      ['multiple tags', '<p>Hello <strong>world</strong> and <em>universe</em></p>'],
      ['self-closing style (treated as regular)', '<br></br>'],
      ['complex nesting', '<div><p>Text with <span>nested <em>emphasis</em></span> content</p></div>'],
    ])('should return true for %s', (_, input) => {
      expect(isValidReactTransString(input)).toBe(true);
    });
  });

  describe('invalid cases', () => {
    it.each([
      ['empty string', ''],
      ['unclosed tag', '<b>unclosed'],
      ['closing tag without opening', '</b>no opening'],
      ['mismatched tags', '<b><i>mismatched</b></i>'],
      ['entity', 'hello &amp; world'],
      ['backslash character', 'hello \\ world'],
      ['malformed tag (no closing bracket)', '<b unclosed'],
      ['empty tag name', '<>content</>'],
      ['tag with spaces in name', '<b old>content</bold>'],
      ['nested mismatched tags', '<div><p>content</div></p>'],
      ['multiple unmatched closing tags', 'content</p></div>'],
      ['mixed valid and invalid', '<p>valid</p> &amp; invalid'],
    ])('should return false for %s', (_, input) => {
      expect(isValidReactTransString(input)).toBe(false);
    });
  });
});
