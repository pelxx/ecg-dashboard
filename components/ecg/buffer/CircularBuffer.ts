export class CircularBuffer<T> {
  private readonly items: T[];
  private writeIndex = 0;
  private count = 0;

  private constructor(
    private readonly limit: number,
    initialValue: T
  ) {
    this.items = new Array<T>(limit).fill(initialValue);
  }

  static create<T>(capacity: number, initialValue: T): CircularBuffer<T> {
    return new CircularBuffer(Math.max(1, capacity), initialValue);
  }

  push(value: T): void {
    this.items[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.limit;
    this.count = Math.min(this.count + 1, this.limit);
  }

  pushChunk(values: readonly T[]): void {
    for (const value of values) {
      this.push(value);
    }
  }

  clear(): void {
    this.writeIndex = 0;
    this.count = 0;
  }

  reset(initialValue: T): void {
    this.items.fill(initialValue);
    this.clear();
  }

  snapshot(): T[] {
    const output = new Array<T>(this.count);
    const start = (this.writeIndex - this.count + this.limit) % this.limit;

    for (let i = 0; i < this.count; i += 1) {
      output[i] = this.items[(start + i) % this.limit];
    }

    return output;
  }

  isFull(): boolean {
    return this.count === this.limit;
  }

  size(): number {
    return this.count;
  }

  capacity(): number {
    return this.limit;
  }
}
