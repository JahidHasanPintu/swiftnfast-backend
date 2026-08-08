import { FilterQuery, PipelineStage } from 'mongoose';
import { CustomerDocument } from '../interfaces/customer.interface';

/**
 * Builds a customer aggregation pipeline that de-duplicates customer documents
 * by contactNumber, keeping the most recently created document for each phone
 * number. Used by the customer list, customer search and XLS export so that
 * "one customer per phone number" is enforced consistently at read time.
 *
 * The pipeline returns `[{ grouped, total }]` where `total[0].n` is the number
 * of distinct customers and `grouped` is the deduped, paginated page.
 */
export function buildCustomerDedupPipeline(
  match: FilterQuery<CustomerDocument>,
  page: number,
  pageSize: number,
): PipelineStage[] {
  const skip = Math.max(0, (page - 1) * pageSize);

  const pipeline: PipelineStage[] = [];

  if (match && Object.keys(match).length > 0) {
    pipeline.push({ $match: match } as PipelineStage);
  }

  pipeline.push({
    $facet: {
      grouped: [
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$contactNumber', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: pageSize },
      ],
      total: [{ $group: { _id: '$contactNumber' } }, { $count: 'n' }],
    },
  });

  return pipeline;
}

/**
 * Interprets the result of `buildCustomerDedupPipeline`, returning the
 * paginated customers plus the count of distinct customers.
 */
export function extractDedupResult(
  raw: { grouped?: CustomerDocument[]; total?: { n: number }[] }[],
): { customers: CustomerDocument[]; totalItems: number } {
  const row = raw[0];
  return {
    customers: row?.grouped ?? [],
    totalItems: row?.total?.[0]?.n ?? 0,
  };
}
