export const mapWithWorkerCount = async <Input, Output>(
  items: readonly Input[],
  maxWorkerCount: number,
  mapper: (item: Input, index: number) => Promise<Output>
): Promise<Output[]> => {
  if (!Number.isInteger(maxWorkerCount) || maxWorkerCount < 1) {
    throw new Error(`Worker count must be a positive integer. Received: ${maxWorkerCount}`);
  }

  const results = new Array<Output>(items.length);
  const queue = items.map((item, index) => ({ index, item }));
  const workerCount = Math.min(maxWorkerCount, queue.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();

      if (!next) {
        return;
      }

      results[next.index] = await mapper(next.item, next.index);
    }
  });

  await Promise.all(workers);

  return results;
};
