'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/services/arithmetic.ts'),'utf8');
assert.doesNotMatch(source,/\b(?:eval|Function)\s*\(/);
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports={};
vm.runInNewContext(output,{exports:moduleExports,Math,Number,Error});
const calc=moduleExports.evaluateArithmetic;
test('arithmetic respects precedence, nesting and unary operators',()=>{
 for(const [input,wanted] of [
  ['2+3*4',14],['(2+3)*4',20],['-4/2 + 6',4],['3*-2',-6],
  ['-(3+4)*2',-14],['.5+0.25',0.75],['12 / (2+4)',2],['7--2',9]
 ]) assert.equal(calc(input),wanted,input);
});
test('rejects division by zero, injections, nonfinite results and invalid syntax',()=>{
 for(const query of ['1/0','2/**3','4+(5','2+2;process.exit()',
  '1e999','2**8','3.2.4','3/0.0',')2+3','1/0.0000',
  '((('.repeat(20)+'3'+')))'.repeat(20),'9'.repeat(170)]) {
  assert.equal(calc(query),null,query);
 }
});
test('never allows number coercion to bypass finite bounds',()=>{
 assert.equal(calc('999999999999999 * 2'),null);
 assert.equal(calc('0/0'),null);
});
