import { ModelObject } from './modelObject';
import { BudgeDragon } from './monsters/budgeDragon';
import { Hound } from './monsters/hound';
import { SkeletonWarrior } from './monsters/skeletonWarrior';
import { Spider } from './monsters/spider';
import { Baz } from './npcs/baz';
import { BerdyshGuard } from './npcs/berdyshGuard';
import { ChaosCardMaster } from './npcs/chaosCardMaster';
import { CrossbowGuard } from './npcs/crossbowGuard';
import { ElfSoldier } from './npcs/elfSoldier';
import { GoldenArcher } from './npcs/goldenArcher';
import { Hanzo } from './npcs/hanzo';
import { Leo } from './npcs/leo';
import { Lumen } from './npcs/lumen';
import { Pasi } from './npcs/pasi';
import { Trainer } from './npcs/trainer';
import { Zyro } from './npcs/zyro';

export const ModelFactoryPerId: Record<number, typeof ModelObject> = {
  [226]: Trainer,
  [240]: Baz,
  [247]: CrossbowGuard,
  [249]: BerdyshGuard,
  [251]: Hanzo,
  [254]: Pasi,
  [255]: Lumen,
  [257]: ElfSoldier,
  [371]: Leo,
  [375]: ChaosCardMaster,
  [543]: ElfSoldier,
  [568]: Zyro,

  // Monsters
  [1]: Hound,
  [2]: BudgeDragon,
  [3]: Spider,
  [14]: SkeletonWarrior,
  [236]: GoldenArcher,
};
