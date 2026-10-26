import type { BodyParameters, Point, Point3 } from './bodyNet';

export interface CardBend { edge: Point[]; across: Point; width: number; angle: number; flat: Point[]; score: Point[]; owner: number }
export type CardFace = { flat: Point[]; solid: Point3[] };
const sub = (a: Point3, b: Point3) => a.map((v, i) => v - b[i]) as Point3;
const dot = (a: Point3, b: Point3) => a.reduce((s,v,i) => s + v * b[i],0);
const cross = (a: Point3,b: Point3): Point3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = (a: Point3) => a.map(v=>v/Math.hypot(...a)) as Point3;
export const neutralRadius = (p: BodyParameters, angle: number, direction=1) => p.bendRadius + (angle*direction < 0 ? 1 - p.neutralAxis / 100 : p.neutralAxis / 100) * p.thickness;
export const bendAllowance = (p: BodyParameters, angle: number, direction=1) => Math.abs(angle) * neutralRadius(p,angle,direction);
export function wallAngles(faces: CardFace[]) {
  const normal = (f: CardFace) => unit(cross(sub(f.solid[1],f.solid[0]),sub(f.solid[3],f.solid[0])));
  return faces.map((f,i) => { const a=normal(f), b=normal(faces[(i+1)%faces.length]), axis=unit(sub(f.solid[2],f.solid[1])); return Math.atan2(dot(axis,cross(a,b)),dot(a,b)); });
}
export function embedCard(faces: CardFace[]) {
  const first=faces[0].solid, base=first[0], along=unit(sub(first[3],base)), edge=sub(first[1],base);
  const across=unit(edge.map((v,i)=>v-dot(edge,along)*along[i]) as Point3);
  return ([x,y]: Point): Point3 => base.map((v,i)=>v+across[i]*x+along[i]*y) as Point3;
}
/** A constant-length neutral arc. At progress zero the same strip is flat. */
export function cardBendInPlane(point: Point3, origin: Point3, end: Point3, acrossPoint: Point3, width: number, angle: number, progress: number, bendCoordinate?: number): Point3 {
  if (width < 1e-9 || Math.abs(angle) < 1e-9) return point;
  const axis=unit(sub(end,origin)), across=unit(sub(acrossPoint,origin)), normal=cross(axis,across), a=angle*progress;
  const sinc=(v:number)=>Math.abs(v)<1e-7?1:Math.sin(v)/v, cosc=(v:number)=>Math.abs(v)<1e-7?v/2:(1-Math.cos(v))/v;
  if (bendCoordinate !== undefined) {
    const u=bendCoordinate, v=dot(sub(point,origin),axis), local=a*u/width;
    return origin.map((o,i)=>o+axis[i]*v+across[i]*u*sinc(local)+normal[i]*u*cosc(local)) as Point3;
  }
  const v=point.map((x,i)=>x-origin[i]-across[i]*width) as Point3, c=Math.cos(a), s=Math.sin(a), perpendicular=cross(axis,v), parallel=dot(axis,v)*(1-c);
  return origin.map((o,i)=>o+across[i]*width*sinc(a)+normal[i]*width*cosc(a)+v[i]*c+perpendicular[i]*s+axis[i]*parallel) as Point3;
}
export const bendAcross = (edge: Point[]): Point => { const [a,b]=edge, len=Math.hypot(b[0]-a[0],b[1]-a[1]); return [(b[1]-a[1])/len,-(b[0]-a[0])/len]; };
export function move(p: Point, d: Point, amount: number): Point { return [p[0]+d[0]*amount,p[1]+d[1]*amount]; }
export function makeBend(edge: Point[], width: number, angle: number, owner: number, direction = 1): CardBend {
  const d=bendAcross(edge).map(v=>v*direction) as Point, [a,b]=edge;
  return {edge,across:d,width,angle,owner,flat:[a,move(a,d,width),move(b,d,width),b],score:edge.map(p=>move(p,d,width/2))};
}
export function bendStrips(bend: CardBend, divisions=8): Point[][] {
  if(bend.width<1e-7)return [];
  const lerp=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const [a,b,c,d]=bend.flat;
  return Array.from({length:divisions},(_,i)=>[lerp(a,b,i/divisions),lerp(a,b,(i+1)/divisions),lerp(d,c,(i+1)/divisions),lerp(d,c,i/divisions)]);
}
/** Rigid wall plates are trimmed to tangent lines. Insert BA between them, after
 * deducting both neutral-axis setbacks from the virtual sharp-wall dimensions. */
export function developCardWalls(reference: CardFace[], p: BodyParameters) {
  const angles=wallAngles(reference), radius=p.bendRadius+p.neutralAxis/100*p.thickness;
  const setbacks=angles.map(a=>radius*Math.tan(Math.abs(a)/2)), allowances=angles.map(a=>bendAllowance(p,a));
  const shifts: Point[]=[[0,0]], faces: CardFace[]=[], bends: CardBend[]=[];
  const seamGap=p.thickness+p.slotClearance;
  for(let i=0;i<reference.length;i++) {
    const original=reference[i], f=original.flat, left=i?setbacks[i-1]:seamGap/2, right=i<reference.length-1?setbacks[i]:seamGap/2;
    const shifted = (point: Point): Point => [point[0]+shifts[i][0],point[1]+shifts[i][1]];
    const inset=(a:Point,b:Point,edge:Point[],offset:number):Point=>{
      const d=bendAcross(edge), from=(a[0]-edge[0][0])*d[0]+(a[1]-edge[0][1])*d[1], change=(b[0]-a[0])*d[0]+(b[1]-a[1])*d[1], t=(offset-from)/change;
      return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    };
    const trimmed=[inset(f[0],f[1],[f[0],f[3]],left),inset(f[1],f[0],[f[1],f[2]],-right),inset(f[2],f[3],[f[1],f[2]],-right),inset(f[3],f[2],[f[0],f[3]],left)];
    // Affine map from the original flat wall to its target neutral plane.
    const ex: Point=[f[1][0]-f[0][0],f[1][1]-f[0][1]], ey: Point=[f[3][0]-f[0][0],f[3][1]-f[0][1]], det=ex[0]*ey[1]-ex[1]*ey[0];
    const solid=trimmed.map(([x,y]):Point3=>{const dx=x-f[0][0],dy=y-f[0][1],u=(dx*ey[1]-dy*ey[0])/det,v=(ex[0]*dy-ex[1]*dx)/det;return original.solid[0].map((a,k)=>a+u*(original.solid[1][k]-a)+v*(original.solid[3][k]-a)) as Point3;});
    faces.push({flat:trimmed.map(shifted),solid});
    if(i<reference.length-1) {
      const d=bendAcross([f[1],f[2]]), delta=allowances[i]-2*setbacks[i];
      shifts.push(move(shifts[i],d,delta));
      const edge=[shifted(move(f[1],d,-setbacks[i])),shifted(move(f[2],d,-setbacks[i]))];
      // Top/bottom edges can slope: keep their tangent intersections, rather
      // than assuming that a rectangular strip covers the entire wall height.
      const next=reference[i+1].flat, shift=shifts[i+1];
      const bottom=inset(next[0],next[1],[next[0],next[3]],setbacks[i]), top=inset(next[3],next[2],[next[0],next[3]],setbacks[i]);
      const bend=makeBend(edge,allowances[i],angles[i],i);
      bend.flat=[faces[i].flat[1],[bottom[0]+shift[0],bottom[1]+shift[1]],[top[0]+shift[0],top[1]+shift[1]],faces[i].flat[2]];
      bend.score=[[0,1],[3,2]].map(([a,b])=>[(bend.flat[a][0]+bend.flat[b][0])/2,(bend.flat[a][1]+bend.flat[b][1])/2] as Point);
      bends.push(bend);
    }
  }
  const minWeb=Math.max(6,3*p.thickness), valid=faces.every(f=>Math.hypot(f.flat[1][0]-f.flat[0][0],f.flat[1][1]-f.flat[0][1])>=minWeb && Math.hypot(f.flat[2][0]-f.flat[3][0],f.flat[2][1]-f.flat[3][1])>=minWeb);
  return {faces,bends,angles,shifts,setbacks,allowances,radius,seamGap,minWeb,valid};
}
