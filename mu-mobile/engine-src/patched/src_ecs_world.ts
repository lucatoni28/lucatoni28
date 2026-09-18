import { type Bucket, World as ECSWorld } from 'miniplex';
import type { IVector2Like, IVector3Like, Mesh } from '../libs/babylon/exports';
import type { ModelObject } from '../common/modelObject';
import type { MonsterActionType, PlayerAction } from '../common/objects/enum';
import type { MUAttributeSystem } from '../libs/attributeSystem';
import { TransformNode } from '../libs/babylon/exports';
import { createPathfinding } from '../libs/pathfinding';
import { CharacterClassNumber, ENUM_WORLD } from '../common';
import { AssetsManager, Color3, Viewport } from '../libs/babylon/exports';
import type { HighlightLayer } from '../libs/babylon/exports';
import type { TestScene } from '../scenes/testScene';

export type EntityTypeFromQuery<TB extends Bucket<any> = Bucket<any>> =
  TB extends Bucket<infer T> ? T : never;

export type ISystemFactory = (world: World) => {
  update?: (deltaTime: number) => void;
};

export type Item = {
  num: number;
  group: number;
  lvl?: number;
  isExcellent?: boolean;
  hasSkill?: boolean;
  /**
   * Ngọc đã khảm. Độ dài mảng = số lỗ đã mở (MU tối đa 5); mỗi ô là mã loại
   * ngọc trong SOCKET_KINDS (src/offline/itemStats.ts) hoặc null nếu lỗ trống.
   */
  sockets?: (number | null)[];
  /** Đồ Thần (Ancient/Divine) — tên hiện màu tím. */
  isDivine?: boolean;
  /**
   * Mặt nạ bit của các dòng Xuất sắc. Sáu bit thấp, nghĩa của từng bit tuỳ
   * theo món là vũ khí hay giáp — xem src/offline/excellent.ts.
   * Chỉ có nghĩa khi isExcellent = true.
   */
  excOptions?: number;
};

export type Entity = Partial<{
  netId: number;
  modelId: number;
  worldIndex: ENUM_WORLD;
  modelFilePath: string;
  npcType: number;
  localPlayer: true;
  transform: {
    pos: IVector3Like;
    rot: IVector3Like;
    scale: number;
    posOffset?: IVector3Like;
  };
  modelObject: ModelObject;
  modelFactory: typeof ModelObject;
  objOutOfScope: true;
  pathfinding: {
    from: IVector2Like;
    to: IVector2Like;
    path: IVector2Like[] | null;
    calculated: boolean;
  };
  playerMoveTo: {
    point: IVector2Like;
    handled: boolean;
    sendToServer?: boolean;
  };
  movement: {
    velocity: IVector2Like;
  };
  playerAnimation: {
    action: PlayerAction;
  };
  monsterAnimation: {
    action: MonsterActionType;
  };
  attributeSystem: MUAttributeSystem;
  visibility: {
    state: 'visible' | 'nearby' | 'hidden';
    lastChecked: number;
  };
  screenPosition: {
    x: number;
    y: number;
    worldOffsetZ: number;
  };
  objectNameInWorld: string;

  /* --- chỉ dùng ở chế độ chơi đơn, xem src/offline/ ---
     Chỉ số quái lấy nguyên từ src/common/monsters.json (321 quái MU thật),
     không đặt tay con số nào. */
  monster: {
    id: number;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    minDmg: number;
    maxDmg: number;
    def: number;
    attackSuccess: number;
    exp: number;
    moneyR: number;
    itemR: number;
    attackSpeed: number;
    home: IVector2Like;
    state: 'idle' | 'chase' | 'attack' | 'dead';
    thinkAt: number;
    attackAt: number;
    diedAt: number;
    aggroRange: number;
    attackRange: number;
  };
  charAppearance: {
    helm: Item | null;
    armor: Item | null;
    pants: Item | null;
    gloves: Item | null;
    boots: Item | null;
    leftHand: Item | null;
    rightHand: Item | null;
    wings: Item | null;
    charClass: CharacterClassNumber;
    changed: boolean;
  };
  highlighted: {
    color: Color3;
    layer: HighlightLayer | null;
  };
  interactable: true;
  keyboardInput: {
    pressedKeys: Set<string>;
  };
  interactiveArea: {
    min: IVector2Like;
    max: IVector2Like;
    inside?: boolean;
    onEnter?: () => void;
    onLeave?: () => void;
  };
  onDispose?: () => void;
}>;

export class World extends ECSWorld<Entity> {
  readonly terrainScale = 100;

  viewport = new Viewport(0, 0, 1, 1);

  readonly gameTime = { TotalGameTime: { TotalSeconds: 0.1 } };

  readonly mapParent: TransformNode;

  readonly netObjsQuery = this.with('netId', 'transform');

  readonly playersQuery = this.with(
    'attributeSystem',
    'transform',
    'playerAnimation',
    'playerMoveTo',
    'pathfinding'
  );

  #localPlayerQuery = this.playersQuery.with('localPlayer');

  get playerEntity() {
    return this.#localPlayerQuery.entities[0];
  }

  #keyboardInputQuery = this.with('keyboardInput');

  get keyboardInput() {
    return this.#keyboardInputQuery.entities[0].keyboardInput;
  }

  mapIndex = ENUM_WORLD.WD_55LOGINSCENE;

  terrain: {
    mesh: Mesh;
    MapTileObjects: (typeof ModelObject)[];
    extraHeight: number;
  } | null = null;

  readonly pathfinder = createPathfinding({
    width: 256,
    height: 256,
  });

  readonly assetsManager: AssetsManager;

  currentPointerTarget: Entity | null = null;

  pointerPressed = false;

  constructor(readonly scene: TestScene) {
    super();

    this.add({
      keyboardInput: {
        pressedKeys: new Set(),
      },
    });

    this.assetsManager = new AssetsManager(this.scene);
    this.assetsManager.useDefaultLoadingScreen = false;

    this.mapParent = new TransformNode('mapParent', scene);
  }

  getTerrainHeight(x: number, y: number): number {
    return -9999;
  }

  isWalkable(x: number, y: number): boolean {
    return true;
  }

  getTerrainFlag(x: number, y: number): number {
    return 0;
  }

  getTerrainTile(x: number, y: number): number {
    return 0;
  }
}
