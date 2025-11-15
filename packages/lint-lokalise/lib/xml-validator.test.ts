import { isValidXML } from './xml-validator.ts';

describe('isValidXML', () => {
  describe('valid cases', () => {
    it.each([
      ['plain text without tags', 'hello world'],
      ['simple valid tag', '<b>bold</b>'],
      ['text with valid tags', 'hello <b>world</b>'],
      ['properly nested tags', '<outer><inner>nested</inner></outer>'],
      ['multiple tags', '<p>Hello <strong>world</strong> and <em>universe</em></p>'],
      ['self-closing style (treated as regular)', '<br></br>'],
      ['complex nesting', '<div><p>Text with <span>nested <em>emphasis</em></span> content</p></div>'],
    ])('should return true for %s', (_, input) => {
      expect(isValidXML(input)).toBe(true);
    });
  });

  describe('invalid cases', () => {
    it.each([
      ['empty string', ''],
      ['unclosed tag', '<b>unclosed'],
      ['closing tag without opening', '</b>no opening'],
      ['mismatched tags', '<b><i>mismatched</b></i>'],
      ['ampersand character', 'hello & world'],
      ['backslash character', 'hello \\ world'],
      ['malformed tag (no closing bracket)', '<b unclosed'],
      ['empty tag name', '<>content</>'],
      ['tag with spaces in name', '<b old>content</bold>'],
      ['nested mismatched tags', '<div><p>content</div></p>'],
      ['multiple unmatched closing tags', 'content</p></div>'],
      ['mixed valid and invalid', '<p>valid</p> & invalid'],
    ])('should return false for %s', (_, input) => {
      expect(isValidXML(input)).toBe(false);
    });
  });
});
