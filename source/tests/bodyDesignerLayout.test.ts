import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freeDesignerRect } from '../src/bodyDesignerLayout';
import type { DesignerRect } from '../src/bodyDesignerLayout';
const overlaps=(a:DesignerRect,b:DesignerRect)=>a.left<b.left+b.width && a.left+a.width>b.left && a.top<b.top+b.height && a.top+a.height>b.top;
test('camera framing leaves left and right drawers clear without shrinking the canvas',()=>{
  const header={left:16,top:16,width:1408,height:64},dock={left:574,top:920,width:292,height:64};
  const left={left:16,top:92,width:340,height:700},right={left:984,top:92,width:440,height:700};
  const a=freeDesignerRect(1440,1000,[header,dock,left]),b=freeDesignerRect(1440,1000,[header,dock,right]);
  assert.ok(a.left>=left.left+left.width+12);assert.ok(b.left+b.width<=right.left-12);
  for(const [rect,panel] of [[a,left],[b,right]])for(const overlay of [header,dock,panel])assert.equal(overlaps(rect,overlay),false);
});
test('a bottom sheet moves the mobile model above it and hiding tools restores the space',()=>{
  const header={left:12,top:12,width:296,height:114},dock={left:14,top:666,width:292,height:62},sheet={left:12,top:282,width:296,height:370};
  const open=freeDesignerRect(320,740,[header,dock,sheet]),closed=freeDesignerRect(320,740,[header,dock]),clear=freeDesignerRect(320,740,[]);
  assert.ok(open.top+open.height<=sheet.top-12);
  assert.ok(closed.width*closed.height>open.width*open.height);assert.ok(clear.width*clear.height>closed.width*closed.height);
  assert.equal(clear.left+clear.width/2,160);assert.equal(clear.top+clear.height/2,370);
});
test('free scene bounds stay inside portrait, landscape and desktop viewports',()=>{
  for(const [width,height] of [[320,740],[375,667],[740,360],[900,600],[1440,1000]]) {
    const overlays=[{left:12,top:12,width:width-24,height:80},{left:width/2-130,top:height-76,width:260,height:64}];
    const free=freeDesignerRect(width,height,overlays);
    assert.ok(free.left>=0&&free.top>=0&&free.width>0&&free.height>0);
    assert.ok(free.left+free.width<=width&&free.top+free.height<=height);
    for(const overlay of overlays)assert.equal(overlaps(free,overlay),false);
  }
});
