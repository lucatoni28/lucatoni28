import monsters from './monsters.json';

export const MonstersDatabase = new (class _MonstersDatabase {
  cache = new Map<number, (typeof monsters)[number]>();

  get(id: number) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const monster = monsters.find(m => m.Numb === id);
    if (monster) {
      this.cache.set(id, monster);
      return monster;
    }

    return null;
  }
})();
