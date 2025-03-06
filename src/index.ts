import { Deobfuscator } from "./deobfuscator";
import { constantRenamerPlugin } from "./plugins/constantRenamerPlugin";
import { dataTransformPlugin } from "./plugins/dataTransformPlugin";
import { functionInlinerPlugin } from "./plugins/functionInlinerPlugin";
import { stringDeobfuscatorPlugin } from "./plugins/stringDeobfuscator";
import * as fs from "fs";
import * as path from "path";

const deobfuscator = new Deobfuscator();
deobfuscator.addPlugin(stringDeobfuscatorPlugin);
deobfuscator.addPlugin(constantRenamerPlugin);
deobfuscator.addPlugin(functionInlinerPlugin);
deobfuscator.addPlugin(dataTransformPlugin);

// Read the obfuscated code from the file
const obfuscatedFilePath = path.join(__dirname, "..", "obfuscated.js");
let obfuscatedCode: string;

try {
  obfuscatedCode = fs.readFileSync(obfuscatedFilePath, "utf8");
} catch (error) {
  console.error(`Error reading obfuscated.js: ${error}`);
  process.exit(1);
}

// Deobfuscate the code
const deobfuscatedCode = deobfuscator.deobfuscate(obfuscatedCode);

// Write the deobfuscated code to a new file
const deobfuscatedFilePath = path.join(__dirname, "..", "deobfuscated.js");
fs.writeFileSync(deobfuscatedFilePath, deobfuscatedCode, "utf8");

console.log(
  `Deobfuscation complete. Output written to ${deobfuscatedFilePath}`
);
