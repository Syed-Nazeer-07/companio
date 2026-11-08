'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {planCompanionMove}=require('../electron/automation/companionMovement.cjs');
const bounds={x:300,y:200,width:360,height:440};
const area={x:0,y:0,width:1920,height:1080};
test('directional moves are small and predictable',()=>{
 assert.deepEqual(planCompanionMove(bounds,area,'left'),{x:236,y:200,moved:true});
 assert.deepEqual(planCompanionMove(bounds,area,'right'),{x:364,y:200,moved:true});
 assert.deepEqual(planCompanionMove(bounds,area,'up'),{x:300,y:136,moved:true});
 assert.deepEqual(planCompanionMove(bounds,area,'down'),{x:300,y:264,moved:true});
});
test('moves remain inside the matching monitor work area',()=>{
 const atEdge={x:1560,y:640,width:360,height:440};
 assert.deepEqual(planCompanionMove(atEdge,area,'right'),{x:1560,y:640,moved:false});
 assert.deepEqual(planCompanionMove(atEdge,area,'down'),{x:1560,y:640,moved:false});
 const sub={x:-900,y:-200,width:360,height:440};
 const screen={x:-1000,y:-300,width:1024,height:768};
 assert.deepEqual(planCompanionMove(sub,screen,'left'),{x:-964,y:-200,moved:true});
});
test('reject untrusted directions and invalid coordinates',()=>{
 assert.equal(planCompanionMove(bounds,area,'center'),null);
 assert.equal(planCompanionMove(bounds,area,'left',2000),null);
 assert.equal(planCompanionMove({x:NaN,y:0,width:100,height:100},area,'up'),null);
});
