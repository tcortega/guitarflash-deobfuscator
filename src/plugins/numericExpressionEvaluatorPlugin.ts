import { Plugin } from '../deobfuscator';
import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import generate from '@babel/generator';

function nodeToString(node: t.Node): string {
  return generate(node).code;
}

function evaluateExpression(node: t.Expression | t.PrivateName): number | null {
  if (t.isNumericLiteral(node)) {
    return node.value;
  } else if (t.isUnaryExpression(node) && node.operator === '-') {
    const operand = evaluateExpression(node.argument);
    return operand !== null ? -operand : null;
  } else if (t.isBinaryExpression(node)) {
    const left = evaluateExpression(node.left);
    const right = evaluateExpression(node.right);
    if (left === null || right === null) return null;
    switch (node.operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '**': return Math.pow(left, right);
      case '%': return left % right;
      default: return null;
    }
  }
  return null;
}

export const numericExpressionEvaluatorPlugin: Plugin = {
  name: 'NumericExpressionEvaluatorPlugin',
  visitor: {
    NumericLiteral(path) {
      const extra = path.node.extra;
      if (extra && typeof extra === 'object' && 'raw' in extra && typeof extra.raw === 'string') {
        if (/^0x/i.test(extra.raw)) {
          const decimalValue = path.node.value;
          path.replaceWith(t.numericLiteral(decimalValue));
          console.log(`Converted hex to decimal: ${extra.raw} -> ${decimalValue}`);
        }
      }
    },
    BinaryExpression(path) {
      if (t.isExpression(path.node.left) && t.isExpression(path.node.right)) {
        const result = evaluateExpression(path.node);
        if (result !== null) {
          const originalExpression = nodeToString(path.node);
          path.replaceWith(t.numericLiteral(result));
          console.log(`Evaluated expression: ${originalExpression} -> ${result}`);
        }
      }
    },
    AssignmentExpression(path) {
      if (t.isExpression(path.node.right)) {
        const result = evaluateExpression(path.node.right);
        if (result !== null) {
          const originalExpression = nodeToString(path.node);
          path.node.right = t.numericLiteral(result);
          console.log(`Evaluated assignment expression: ${originalExpression} -> ${nodeToString(path.node)}`);
        }
      }
    },
    UnaryExpression(path) {
      if (path.node.operator === '-' && t.isNumericLiteral(path.node.argument)) {
        const result = -path.node.argument.value;
        const originalExpression = nodeToString(path.node);
        path.replaceWith(t.numericLiteral(result));
        console.log(`Evaluated unary expression: ${originalExpression} -> ${result}`);
      }
    }
  }
};