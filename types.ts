
export enum VectorStyleEnum {
  Detailed = 'Detailed',
  Minimalist = 'Minimalist',
  BlackAndWhite = 'Black & White',
  PopArt = 'Pop Art',
}

export type VectorStyle = `${VectorStyleEnum}`;

export interface Palette {
  name: string;
  colors: string[];
}
   