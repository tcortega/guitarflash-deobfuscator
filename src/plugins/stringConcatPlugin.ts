import { Plugin } from '../deobfuscator';
import * as t from '@babel/types';

function isStringConcatenation(node: t.Node): node is t.BinaryExpression {
    return t.isBinaryExpression(node) && node.operator === '+' &&
      (t.isStringLiteral(node.left) || isStringConcatenation(node.left)) &&
      (t.isStringLiteral(node.right) || isStringConcatenation(node.right));
  }
  
  function extractStrings(node: t.Expression | t.PrivateName): string[] {
    if (t.isStringLiteral(node)) {
      return [node.value];
    } else if (t.isBinaryExpression(node) && node.operator === '+') {
      return [...extractStrings(node.left), ...extractStrings(node.right)];
    }
    return [];
  }
  
  export const stringConcatPlugin: Plugin = {
    name: 'StringConcatPlugin',
    visitor: {
      BinaryExpression: {
        exit(path) {
          if (isStringConcatenation(path.node)) {
            const strings = [...extractStrings(path.node.left), ...extractStrings(path.node.right)];
            const concatenatedValue = strings.join('');
            console.log(`Concatenated strings: ${strings.map(s => `"${s}"`).join(' + ')} -> "${concatenatedValue}"`);
            path.replaceWith(t.stringLiteral(concatenatedValue));
          }
        }
      }
    }
  };