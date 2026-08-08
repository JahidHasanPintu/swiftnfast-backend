import {
  buildCustomerDedupPipeline,
  extractDedupResult,
} from './customer.aggregation';

describe('buildCustomerDedupPipeline', () => {
  it('groups by contactNumber keeping the newest doc (one per phone)', () => {
    const pipeline: any[] = buildCustomerDedupPipeline({}, 1, 10);

    const facet = pipeline.find((s) => s.$facet);
    expect(facet).toBeDefined();

    const grouped = facet.$facet.grouped.map((s: any) => Object.keys(s)[0]);
    const total = facet.$facet.total.map((s: any) => Object.keys(s)[0]);

    // Newest-first sort BEFORE group so $first picks the latest record.
    expect(grouped).toEqual([
      '$sort',
      '$group',
      '$replaceRoot',
      '$sort',
      '$skip',
      '$limit',
    ]);
    expect(grouped[0]).toBe('$sort');
    expect(grouped[1]).toBe('$group');
    expect(facet.$facet.grouped[1].$group._id).toBe('$contactNumber');
    expect(facet.$facet.grouped[2].$replaceRoot.newRoot).toBe('$doc');
    expect(facet.$facet.grouped[3].$sort.createdAt).toBe(-1);

    // Distinct count facet.
    expect(total).toEqual(['$group', '$count']);
    expect(facet.$facet.total[0].$group._id).toBe('$contactNumber');
    expect(facet.$facet.total[1].$count).toBe('n');
  });

  it('prepends the $match stage when a filter is supplied', () => {
    const pipeline: any[] = buildCustomerDedupPipeline(
      { customerName: 'Mamun' },
      1,
      10,
    );
    expect(pipeline[0].$match).toEqual({ customerName: 'Mamun' });
  });

  it('applies skip/limit from page and pageSize', () => {
    const pipeline: any[] = buildCustomerDedupPipeline({}, 3, 25);
    const facet = pipeline.find((s) => s.$facet);
    const grouped = facet.$facet.grouped;
    expect(grouped.find((s: any) => s.$skip).$skip).toBe(50);
    expect(grouped.find((s: any) => s.$limit).$limit).toBe(25);
  });
});

describe('extractDedupResult', () => {
  it('returns grouped customers and distinct total', () => {
    const customers = [{ customerName: 'A' }, { customerName: 'B' }];
    const { customers: out, totalItems } = extractDedupResult([
      { grouped: customers, total: [{ n: 2 }] },
    ] as any);
    expect(out).toBe(customers);
    expect(totalItems).toBe(2);
  });

  it('returns empty page and zero total for an empty result', () => {
    const { customers, totalItems } = extractDedupResult([]);
    expect(customers).toEqual([]);
    expect(totalItems).toBe(0);
  });
});
