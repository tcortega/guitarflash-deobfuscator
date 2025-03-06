import { Plugin } from "../deobfuscator";
import * as t from "@babel/types";

const deobfuscatedStrings = new Map<number, string>();
export const stringDeobfuscatorPlugin: Plugin = {
  name: "string-deobfuscator",
  visitor: {
    Program: {
      enter(path) {
        // Store for our deobfuscated strings

        // Find and process the string array first
        path.traverse(
          {
            VariableDeclarator(innerPath) {
              if (
                t.isIdentifier(innerPath.node.id, { name: "r" }) &&
                t.isArrayExpression(innerPath.node.init)
              ) {
                innerPath.node.init.elements.forEach((element, index) => {
                  if (t.isStringLiteral(element)) {
                    const deobfuscated = deobfuscateString(element.value);
                    deobfuscatedStrings.set(index, deobfuscated);
                  }
                });
              }
            },
          },
          this
        );
      },
    },

    // Handle calls to the deobfuscation function
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee, { name: "n" }) &&
        path.node.arguments.length === 1
      ) {
        const arg = path.node.arguments[0];
        if (t.isNumericLiteral(arg)) {
          const index = arg.value;
          const deobfuscated = deobfuscatedStrings.get(index);
          if (deobfuscated) {
            path.replaceWith(t.stringLiteral(deobfuscated));
          }
        }
      }
    },
  },
};

// ROT13 deobfuscation function that matches the original code
function deobfuscateString(str: string): string {
  const shift = 13; // 13 % 26
  return str
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        // Uppercase letters
        return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
      } else if (code >= 97 && code <= 122) {
        // Lowercase letters
        return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
      }
      return char; // Non-alphabetic characters remain unchanged
    })
    .join("");
}
