import type { Point, Point3 } from './bodyNet';
import { cardBendInPlane, embedCard, move } from './cardMaterial';
import type { CardBend, CardFace } from './cardMaterial';
export interface CardPoseModel { p:{sides:number}; referenceFaces:CardFace[]; faces:CardFace[]; material:{bends:CardBend[]}; tabBends:CardBend[] }

/** Finite neutral-radius bend strips connect rigid wall plates. */
export function bodyFoldingPose(model: CardPoseModel, fraction: number) {
  const amount=Number.isFinite(fraction)?Math.max(0,Math.min(1,fraction)):1, embed=embedCard(model.referenceFaces);
  const apply=(point:Point3,bend:CardBend,u?:number)=>cardBendInPlane(point,embed(bend.edge[0]),embed(bend.edge[1]),embed(move(bend.edge[0],bend.across,1)),bend.width,bend.angle,amount,u);
  const parents=(point:Point3,count:number)=>{for(let i=count-1;i>=0;i--)point=apply(point,model.material.bends[i]);return point;};
  const point=(face:number,flat:Point):Point3=>{
    let result=embed(flat);
    if(face===model.p.sides) {
      for(let i=model.tabBends.length-1;i>=0;i--) {
        const bend=model.tabBends[i], u=(flat[0]-bend.edge[0][0])*bend.across[0]+(flat[1]-bend.edge[0][1])*bend.across[1];
        if(u>0)result=apply(result,bend,u<bend.width?u:undefined);
      }
    }
    return parents(result,Math.min(face,model.material.bends.length));
  };
  const bendPoint=(index:number,flat:Point):Point3=>{
    const bend=model.material.bends[index], u=(flat[0]-bend.edge[0][0])*bend.across[0]+(flat[1]-bend.edge[0][1])*bend.across[1];
    return parents(apply(embed(flat),bend,Math.max(0,Math.min(bend.width,u))),index);
  };
  return {point,bendPoint,faces:model.faces.map((face,i)=>face.flat.map(p=>point(i,p)))};
}
