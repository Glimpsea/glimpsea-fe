declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string);
    exec(sql: string): void;
    query(sql: string): {
      get(...values: (string | number)[]): unknown;
      run(...values: (string | number)[]): { changes: number };
    };
  }
}
