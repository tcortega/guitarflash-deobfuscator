import { parse } from '@babel/parser';
import traverse, { Visitor } from '@babel/traverse';
import generate from '@babel/generator';

export interface Plugin {
  name: string;
  visitor: Visitor;
}

export class Deobfuscator {
  private plugins: Plugin[] = [];

  constructor() {}

  addPlugin(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  deobfuscate(code: string): string {
    const ast = parse(code);

    this.plugins.forEach(plugin => {
      traverse(ast, plugin.visitor);
    });

    const output = generate(ast);
    return output.code;
  }
}