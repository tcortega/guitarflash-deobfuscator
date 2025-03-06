import { Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { Plugin } from "../deobfuscator";

export const dataTransformPlugin: Plugin = {
  name: "data-transform",
  visitor: {
    FunctionDeclaration(path) {
      // Track important data transformation functions
      const functions: Record<string, string> = {
        Gn: "XOR hex strings with key",
        Zn: "Convert number to padded hex string",
        pc: "Generate request token",
        Pc: "Create token object",
        bu: "Shuffle and XOR string",
        Iu: "Hash string (MurmurHash3)",
        Yi: "Pack screen dimensions",
        Hi: "Pack boolean array",
        Di: "Add data to token object",
      };

      const functionName = path.node.id?.name;
      if (functionName && functions[functionName]) {
        // Add explanatory comment
        path.addComment(
          "leading",
          `Function: ${functions[functionName]}\n` +
            `Used by: createRequestToken() flow`
        );

        // Rename variables to be more descriptive
        path.scope.traverse(path.node, {
          Identifier(idPath) {
            const renames: Record<string, string> = {
              n: "input",
              r: "key",
              t: "result",
              u: "temp",
              e: "len",
              i: "index",
              c: "bytes",
              f: "output",
            };

            const name = idPath.node.name;
            if (idPath.isReferencedIdentifier() && name in renames) {
              idPath.replaceWith(t.identifier(renames[name]));
            }
          },
        });
      }
    },

    CallExpression(path) {
      // Add comments for key function calls in token generation
      const trackedCalls = new Set([
        "Gn",
        "Zn",
        "pc",
        "Pc",
        "bu",
        "Iu",
        "Yi",
        "Hi",
        "Di",
      ]);

      const callee = path.node.callee;
      if (t.isIdentifier(callee) && trackedCalls.has(callee.name)) {
        path.addComment("leading", `${callee.name} function call`);
      }
    },
  },
};
