import { Plugin } from "../deobfuscator";
import * as t from "@babel/types";

const functionMap = new Map();
function inlineFunction(
  func: t.FunctionDeclaration | t.FunctionExpression,
  args: Array<t.ArgumentPlaceholder | t.Expression | t.SpreadElement>
): t.Expression | null {
  // Filter to ensure we only have Expression types
  const expressions = args.filter((arg): arg is t.Expression =>
    t.isExpression(arg)
  );

  // Check if we lost any arguments in the filter
  if (expressions.length !== args.length) {
    return null;
  }

  // Get function parameters
  const params = func.params;
  if (expressions.length !== params.length) {
    return null;
  }

  // Create scope for parameter substitution
  const paramMap = new Map();
  params.forEach((param, i) => {
    if (t.isIdentifier(param)) {
      paramMap.set(param.name, expressions[i]);
    }
  });

  // Handle simple returns
  if (t.isBlockStatement(func.body) && func.body.body.length === 1) {
    const statement = func.body.body[0];
    if (t.isReturnStatement(statement) && statement.argument) {
      // Replace parameters with arguments in the return expression
      const replacedReturn = replaceParams(statement.argument, paramMap);
      if (replacedReturn) {
        return replacedReturn;
      }
    }
  }

  return null;
}

function replaceParams(
  node: t.Node,
  paramMap: Map<string, t.Expression>
): t.Expression | null {
  if (t.isIdentifier(node)) {
    const replacement = paramMap.get(node.name);
    if (replacement) {
      return replacement;
    }
  }

  if (t.isBinaryExpression(node)) {
    const left = replaceParams(node.left, paramMap);
    const right = replaceParams(node.right, paramMap);
    if (left && right) {
      return t.binaryExpression(node.operator, left, right);
    }
  }

  if (t.isCallExpression(node)) {
    const callee = t.isIdentifier(node.callee)
      ? node.callee
      : replaceParams(node.callee, paramMap);
    const args = node.arguments.map((arg) => {
      if (t.isExpression(arg)) {
        return replaceParams(arg, paramMap) || arg;
      }
      return arg;
    });
    if (callee) {
      return t.callExpression(callee as any, args as any[]);
    }
  }

  if (t.isLogicalExpression(node)) {
    const left = replaceParams(node.left, paramMap);
    const right = replaceParams(node.right, paramMap);
    if (left && right) {
      return t.logicalExpression(node.operator, left, right);
    }
  }

  if (t.isMemberExpression(node)) {
    const object = replaceParams(node.object, paramMap);
    const property = node.computed
      ? replaceParams(node.property, paramMap)
      : node.property;
    if (object && property) {
      return t.memberExpression(object, property as any, node.computed);
    }
  }

  if (t.isExpression(node)) {
    return node;
  }

  return null;
}

function isSimpleFunction(
  node: t.FunctionDeclaration | t.FunctionExpression
): boolean {
  if (!t.isBlockStatement(node.body)) {
    return false;
  }

  // Only inline functions with a single return statement
  if (node.body.body.length !== 1) {
    return false;
  }

  const statement = node.body.body[0];
  return t.isReturnStatement(statement);
}

export const functionInlinerPlugin: Plugin = {
  name: "function-inliner",
  visitor: {
    Program: {
      enter(path) {
        path.traverse(
          {
            FunctionDeclaration(path) {
              const name = path.node.id?.name;
              if (name) {
                this.functionMap.set(name, path.node);
              }
            },
            VariableDeclarator(path) {
              if (
                t.isFunctionExpression(path.node.init) &&
                t.isIdentifier(path.node.id)
              ) {
                this.functionMap.set(path.node.id.name, path.node.init);
              }
            },
          },
          { functionMap: functionMap }
        );
      },
    },

    CallExpression(path) {
      const trackedFunctions = new Set([
        "Qc",
        "Pc",
        "pc",
        "$n",
        "wc",
        "Ac",
        "Zn",
        "Gn",
        "Nc",
        "Fc",
        "Vc",
      ]);

      const callee = path.node.callee;
      if (t.isIdentifier(callee) && trackedFunctions.has(callee.name)) {
        const impl = functionMap.get(callee.name);
        if (impl && path.scope.getBinding(callee.name)?.constant) {
          // Add a comment explaining what the function does
          path.addComment("leading", ` ${callee.name} function call`);

          if (isSimpleFunction(impl)) {
            const inlined = inlineFunction(impl, path.node.arguments);
            if (inlined) {
              path.replaceWith(inlined);
            }
          }
        }
      }
    },
  },
};
