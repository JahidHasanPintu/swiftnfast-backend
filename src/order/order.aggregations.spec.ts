import {
  buildOrderGroupingStages,
  buildDistinctOrderCountStages,
} from './order.aggregations';

describe('buildOrderGroupingStages', () => {
  it('groups line-items by orderId into one row per order', () => {
    const stages: any[] = buildOrderGroupingStages();

    const group = stages.find((s) => s.$group);
    expect(group.$group._id).toBe('$orderId');
    expect(group.$group.orders.$push).toBe('$$ROOT');
    expect(group.$group.latestOrder.$first).toBe('$$ROOT');

    // Newest item is chosen as the representative order.
    expect(stages[0].$sort.createdAt).toBe(-1);

    // computed status prefers Pending, then Cancelled, else Purchased.
    const addFields = stages.find(
      (s) => s.$addFields && s.$addFields.calculatedStatus,
    );
    expect(addFields.$addFields.calculatedStatus).toBeDefined();

    // statuses are lowercased before matching so mixed-case enums group right.
    const normalize = stages.find((s) => s.$addFields?.statuses);
    expect(normalize).toBeDefined();

    // replaceRoot flattens the group into a single order-shaped document.
    const replaceRoot = stages.find((s) => s.$replaceRoot);
    expect(replaceRoot.$replaceRoot.newRoot.orderId).toBe('$_id');
    expect(replaceRoot.$replaceRoot.newRoot.status).toBe('$calculatedStatus');
  });

  it('grouping sorts newest-first before $group', () => {
    const stages: any[] = buildOrderGroupingStages();
    expect(stages[0]).toEqual({ $sort: { createdAt: -1 } });
  });
});

describe('buildDistinctOrderCountStages', () => {
  it('counts distinct orderIds', () => {
    const stages: any[] = buildDistinctOrderCountStages();
    expect(stages).toEqual([
      { $group: { _id: '$orderId' } },
      { $count: 'count' },
    ]);
  });
});
