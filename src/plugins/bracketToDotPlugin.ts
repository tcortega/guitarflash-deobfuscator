import { Plugin } from '../deobfuscator';
import * as t from '@babel/types';

function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

export const bracketToDotPlugin: Plugin = {
  name: 'BracketToDotPlugin',
  visitor: {
    MemberExpression(path) {
      if (
        path.node.computed &&
        t.isStringLiteral(path.node.property) &&
        isValidIdentifier(path.node.property.value)
      ) {
        const propertyName = path.node.property.value;
        path.node.computed = false;
        path.node.property = t.identifier(propertyName);
        console.log(`Transformed bracket notation to dot notation: ${propertyName}`);
      }
    },
    VariableDeclarator(path) {
      if (
        t.isMemberExpression(path.node.init) &&
        path.node.init.computed &&
        t.isStringLiteral(path.node.init.property) &&
        isValidIdentifier(path.node.init.property.value)
      ) {
        const propertyName = path.node.init.property.value;
        path.node.init.computed = false;
        path.node.init.property = t.identifier(propertyName);
        console.log(`Transformed bracket notation to dot notation in variable declaration: ${propertyName}`);
      }
    }
  }
};