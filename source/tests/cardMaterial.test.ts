import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultBody, makeBody, bodySvg } from '../src/robot/bodyNet';
import { bodyFoldingPose } from '../src/robot/bodyFolding';
import { defaultDecoration } from '../src/robot/bodyDecoration';
import { bendAllowance, move } from '../src/robot/cardMaterial';
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('a square sleeve deducts tangent setbacks and adds the developed 90-degree arcs',()=>{
  const model=makeBody({...defaultBody,sides:4,taper:100,thickness:1,bendRadius:.5,neutralAxis:50});
  assert.ok(model.valid);
  for(const bend of model.material.bends)assert.ok(Math.abs(bend.width-Math.PI/2)<1e-9);
  const first=model.faces[0].flat[0],last=model.faces.at(-1)!.flat[1];
  const expected=4*180-6+3*Math.PI/2-model.material.seamGap;
  assert.ok(Math.abs(distance(first,last)-expected)<1e-8);
});
test('finite bend arcs keep their developed length throughout folding',()=>{
  const model=makeBody({...defaultBody,sides:4,taper:100,thickness:1,bendRadius:.5});
  const bend=model.material.bends[0], start=bend.score[0].map((v,i)=>v+(bend.score[1][i]-bend.score[0][i])*.5) as [number,number];
  const origin=move(start,bend.across,-bend.width/2);
  for(const progress of [.2,.5,1]){
    const pose=bodyFoldingPose(model,progress), points=Array.from({length:1001},(_,i)=>pose.bendPoint(0,move(origin,bend.across,bend.width*i/1000)));
    const length=points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);
    assert.ok(Math.abs(length-bend.width)<1e-6);
  }
});
test('thicker card changes the net, fold zones, tabs, actual slot width and available clearance',()=>{
  const models=[.3,1,2.5].map(thickness=>makeBody({...defaultBody,thickness}));
  for(let i=1;i<models.length;i++){
    const a=models[i-1],b=models[i];assert.ok(b.valid);
    assert.notDeepEqual(a.boundary,b.boundary);assert.notDeepEqual(a.folds,b.folds);
    assert.ok(b.tabDimensions.reach>a.tabDimensions.reach);
    assert.ok(b.slots[0][1][0]-b.slots[0][0][0]>a.slots[0][1][0]-a.slots[0][0][0]);
    assert.ok(b.innerDiameter<a.innerDiameter);assert.deepEqual(a.referenceFaces,b.referenceFaces);
  }
  const guide=bodySvg(models[1],true),cut=bodySvg(models[1]);
  assert.ok(guide.includes('BEND_GUIDE'));assert.ok(!cut.includes('BEND_GUIDE'));
  assert.ok(cut.includes('Card thickness 1 mm'));assert.ok(!cut.includes('Zero-thickness'));
});
test('reverse bends and calibration settings alter material allowance; tight thick-card details are blocked',()=>{
  const p={...defaultBody,thickness:2,neutralAxis:30};
  assert.ok(Math.abs(bendAllowance(p,Math.PI/2)-Math.PI/2*.9)<1e-9);
  assert.ok(Math.abs(bendAllowance(p,-Math.PI/2)-Math.PI/2*1.7)<1e-9);
  const detail={...defaultDecoration,ornament:'accordion' as const,height:12};
  assert.ok(makeBody({...defaultBody,thickness:.3},undefined,detail).decoration.materialValid);
  assert.equal(makeBody({...defaultBody,thickness:3},undefined,detail).valid,false);
});
test('stepped tabs clear the receiving wall and return onto its outer side, including a flat seam',()=>{
  for(const section of [0,1])for(const thickness of [.3,1,2.5]){
    const model=makeBody({...defaultBody,taper:100,section,thickness}),pose=bodyFoldingPose(model,1),f=model.faces[0].solid;
    const a=f[1].map((v,i)=>v-f[0][i]),b=f[3].map((v,i)=>v-f[0][i]);
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);
    const signed=(point:number[])=>point.reduce((s,v,i)=>s+(v-f[0][i])*n[i]/len,0);
    const root=model.tabPolygons[0][0],across=model.tabBends[0].across;
    const beforeReturn=pose.point(model.p.sides,move(root,across,model.tabDimensions.returnStart));
    const tongue=pose.point(model.p.sides,move(root,across,model.tabDimensions.reach-3));
    assert.ok(signed(beforeReturn)<-thickness/2);
    assert.ok(signed(tongue)>thickness/2);
    assert.ok(model.slots[0][1][0]-model.slots[0][0][0]>=thickness+model.p.slotClearance);
  }
});
