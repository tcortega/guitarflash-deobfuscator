import { Plugin } from '../deobfuscator';
import * as t from '@babel/types';
import { NodePath, Scope } from '@babel/traverse';

interface StringMap {
  [key: string]: string[];
}

interface ScopedInfo {
  stringArrays: StringMap;
  deobfuscationFunctions: Set<string>;
  functionAliases: Map<string, string>;
}

function getScopedInfo(scope: Scope): ScopedInfo {
  if (!scope.data.scopedInfo) {
    scope.data.scopedInfo = {
      stringArrays: {},
      deobfuscationFunctions: new Set<string>(),
      functionAliases: new Map<string, string>()
    };
  }
  return scope.data.scopedInfo as ScopedInfo;
}

function scrambleArray(arr: string[]): string[] {
  const scrambled = [...arr];
  let count = 0xdd;
  while (count--) {
    scrambled.push(scrambled.shift()!);
  }
  return scrambled;
}

export const stringDeobfuscatorPlugin: Plugin = {
  name: 'StringDeobfuscatorPlugin',
  visitor: {
    Program: {
      enter(path) {
        console.log("Entering Program");

        // First pass: collect all string arrays, deobfuscation functions, and aliases
        path.traverse({
          VariableDeclarator(vPath) {
            if (t.isIdentifier(vPath.node.id)) {
              const varName = vPath.node.id.name;
              const scopedInfo = getScopedInfo(vPath.scope);

              if (t.isArrayExpression(vPath.node.init)) {
                const elements = vPath.node.init.elements;
                if (elements.every(el => t.isStringLiteral(el))) {
                  let stringArray = elements.map(el => (el as t.StringLiteral).value);
                  if (varName === 'z') {
                    stringArray = scrambleArray(stringArray);
                    console.log(`Scrambled array 'z'`);
                  }
                  scopedInfo.stringArrays[varName] = stringArray;
                  console.log(`Found string array: ${varName} in scope ${vPath.scope.uid}`);
                }
              } else if (t.isFunctionExpression(vPath.node.init) || t.isArrowFunctionExpression(vPath.node.init)) {
                scopedInfo.deobfuscationFunctions.add(varName);
                console.log(`Found potential deobfuscation function: ${varName} in scope ${vPath.scope.uid}`);
              } else if (t.isIdentifier(vPath.node.init)) {
                scopedInfo.functionAliases.set(varName, vPath.node.init.name);
                console.log(`Found potential function alias: ${varName} -> ${vPath.node.init.name} in scope ${vPath.scope.uid}`);
              }
            }
          },
          FunctionDeclaration(fPath) {
            if (t.isIdentifier(fPath.node.id)) {
              const scopedInfo = getScopedInfo(fPath.scope);
              scopedInfo.deobfuscationFunctions.add(fPath.node.id.name);
              console.log(`Found potential deobfuscation function: ${fPath.node.id.name} in scope ${fPath.scope.uid}`);
            }
          },
          AssignmentExpression(aPath) {
            if (t.isIdentifier(aPath.node.left) && t.isIdentifier(aPath.node.right)) {
              const scopedInfo = getScopedInfo(aPath.scope);
              scopedInfo.functionAliases.set(aPath.node.left.name, aPath.node.right.name);
              console.log(`Found potential function alias: ${aPath.node.left.name} -> ${aPath.node.right.name} in scope ${aPath.scope.uid}`);
            }
          }
        });

        // Second pass: trace and replace obfuscated function calls
        path.traverse({
          CallExpression(cPath) {
            if (t.isIdentifier(cPath.node.callee)) {
              const funcName = cPath.node.callee.name;
              console.log(`Examining call to function: ${funcName} in scope ${cPath.scope.uid}`);
              
              let currentScope: Scope | null = cPath.scope;
              let currentFuncName = funcName;
              let deobfuscationFunction: NodePath | null = null;

              while (currentScope && !deobfuscationFunction) {
                const scopedInfo = getScopedInfo(currentScope);
                
                while (scopedInfo.functionAliases.has(currentFuncName)) {
                  currentFuncName = scopedInfo.functionAliases.get(currentFuncName)!;
                }
                
                if (scopedInfo.deobfuscationFunctions.has(currentFuncName)) {
                  const binding = currentScope.getBinding(currentFuncName);
                  if (binding) {
                    deobfuscationFunction = binding.path;
                    break;
                  }
                }
                
                currentScope = currentScope.parent;
              }

              if (deobfuscationFunction) {
                console.log(`Analyzing function: ${currentFuncName} in scope ${deobfuscationFunction.scope.uid}`);
                let arrayAccess: t.MemberExpression | null = null;
                let offset = 0;
                let arrayName = '';

                // Analyze the function body
                let funcNode;
                if (t.isFunctionDeclaration(deobfuscationFunction.node)) {
                  funcNode = deobfuscationFunction.node;
                } else if (t.isVariableDeclarator(deobfuscationFunction.node) &&
                           (t.isFunctionExpression(deobfuscationFunction.node.init) || t.isArrowFunctionExpression(deobfuscationFunction.node.init))) {
                  funcNode = deobfuscationFunction.node.init;
                }

                if (funcNode) {
                  console.log(`Function node type: ${funcNode.type}`);
                  if (t.isBlockStatement(funcNode.body)) {
                    for (const statement of funcNode.body.body) {
                      if (t.isExpressionStatement(statement) && t.isAssignmentExpression(statement.expression)) {
                        // Check for offset calculation
                        if (t.isBinaryExpression(statement.expression.right) && 
                            t.isNumericLiteral(statement.expression.right.right)) {
                          offset = statement.expression.right.right.value;
                          console.log(`Found offset: ${offset}`);
                        }
                      } else if (t.isVariableDeclaration(statement)) {
                        // Check for array access
                        const declarator = statement.declarations[0];
                        if (t.isVariableDeclarator(declarator) && t.isMemberExpression(declarator.init)) {
                          arrayAccess = declarator.init;
                          if (t.isIdentifier(arrayAccess.object)) {
                            arrayName = arrayAccess.object.name;
                            console.log(`Found array access: ${arrayName}`);
                          }
                        }
                      }
                    }
                  } else {
                    console.log(`Function body is not a BlockStatement: ${funcNode.body.type}`);
                  }
                } else {
                  console.log(`Could not identify function node for ${currentFuncName}`);
                }

                if (arrayName) {
                  let currentScope: Scope | null = deobfuscationFunction.scope;
                  let stringArray: string[] | null = null;

                  while (currentScope && !stringArray) {
                    const scopedInfo = getScopedInfo(currentScope);
                    if (scopedInfo.stringArrays[arrayName]) {
                      stringArray = scopedInfo.stringArrays[arrayName];
                      break;
                    }
                    currentScope = currentScope.parent;
                  }

                  if (stringArray) {
                    const arg = cPath.node.arguments[0];
                    if (t.isNumericLiteral(arg)) {
                      const index = arg.value - offset;
                      const deobfuscatedString = stringArray[index];
                      if (deobfuscatedString) {
                        console.log(`Deobfuscated: ${funcName}(${arg.value}) -> "${deobfuscatedString}" in scope ${cPath.scope.uid}`);
                        cPath.replaceWith(t.stringLiteral(deobfuscatedString));
                      }
                    }
                  }
                }
              }
            }
          }
        });
      }
    }
  }
};