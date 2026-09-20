import type { IVector2Like } from './babylon/exports';
import { Graph, type GridNode, astar } from './astar';

type Grid = number[][];

type MapInfo = {
  width: number;
  height: number;
};

export type Pathfinding<TValue> = {
  graph: Graph;
  mapInfo: MapInfo;
  posToIndex: (pos: IVector2Like) => [number, number];
  indexToPos: (ind: [number, number]) => IVector2Like;
  search: (
    from: IVector2Like,
    to: IVector2Like,
    options?: Parameters<(typeof astar)['search']>[3]
  ) => IVector2Like[];
  findNode: (point: IVector2Like) => GridNode<TValue> | undefined;
  getNode: (i: number, j: number) => GridNode<TValue> | undefined;
  parseString: (str: string) => void;
  generateString: () => string;
  idToIndex: (id: number, ref?: [number, number]) => [number, number];
  indexToId: (i: number, j: number) => number;
  applyOpenedPatch: (ids: number[]) => void;
  applyClosedPatch: (ids: number[]) => void;
  clear: () => void;
};

export function createPathfinding<TValue = number>(
  mapInfo: MapInfo
): Pathfinding<TValue> {
  const grid: Grid = [];

  for (let i = 0; i < mapInfo.width; i++) {
    grid[i] = [];
    for (let j = 0; j < mapInfo.height; j++) {
      grid[i][j] = 1;
    }
  }
  //TODO handle cell size

  const graph = new Graph(grid, { diagonal: true });

  function posToIndex(v3: IVector2Like): [number, number] {
    let { x, y } = v3;
    x += 0.5;
    y += 0.5;
    const i = Math.floor(x);
    const j = Math.floor(y);
    return [i, j];
  }

  function indexToV3(ind: [number, number]): IVector2Like {
    return { x: ind[0], y: ind[1] };
  }

  const getNode = (i: number, j: number): GridNode<TValue> | undefined => {
    const a = graph.grid[i];
    if (a == null) return undefined;

    return a[j] as GridNode<TValue>;
  };

  function indexToId(i: number, j: number): number {
    return i * mapInfo.height + j;
  }

  return {
    mapInfo,
    graph,
    posToIndex: posToIndex,
    indexToPos: indexToV3,
    search: (from, to, options) => {
      const startPoint = posToIndex(from);
      const finishPoint = posToIndex(to);
      const start = graph.grid[startPoint[0]][startPoint[1]];
      const finish = graph.grid[finishPoint[0]][finishPoint[1]];
      // const st = window.performance.now();
      const result = astar.search(graph, start, finish, options);
      // const dt = window.performance.now() - st;
      // console.log(result, 'dt:' + dt);

      return [
        indexToV3(startPoint),
        ...result.map(node => {
          return indexToV3([node.x, node.y]);
        }),
      ];
    },
    getNode,
    findNode: point => {
      const startPoint = posToIndex(point);
      return getNode(startPoint[0], startPoint[1]);
    },
    generateString: () => {
      const s: number[] = new Array(mapInfo.height * mapInfo.width);
      graph.grid.forEach(r => {
        s.push(...r.map(node => node.weight));
      });
      return s.join('');
    },
    parseString: (str: string) => {
      graph.grid.forEach((row, i) => {
        row.forEach((_, j) => {
          graph.grid[i][j].weight = str[indexToId(i, j)] === '0' ? 0 : 1;
        });
      });
    },
    idToIndex: (id, ref) => {
      const x = Math.floor(id / mapInfo.height);
      const z = id % mapInfo.height;
      if (ref !== undefined) {
        ref[0] = x;
        ref[1] = z;
        return ref;
      }
      return [x, z];
    },
    indexToId,
    applyOpenedPatch: (ids: number[]) => {
      ids.forEach(id => {
        const x = Math.floor(id / mapInfo.height);
        const z = id % mapInfo.height;

        const row = graph.grid[x];
        if (row == null) return;
        const col = row[z];
        if (col == null) return;

        col.weight = 1;
      });
    },
    applyClosedPatch: (ids: number[]) => {
      if (!ids || !Array.isArray(ids)) return;

      ids.forEach(id => {
        const x = Math.floor(id / mapInfo.height);
        const z = id % mapInfo.height;

        const row = graph.grid[x];
        if (row == null) return;
        const col = row[z];
        if (col == null) return;

        col.weight = 0;
      });
    },
    clear: () => {
      graph.grid.forEach(row => {
        row.forEach(node => {
          node.weight = 1;
        });
      });
    },
  };
}
