import { http, HttpResponse } from 'msw'
import { expandFromNode, getFullGraph, getNodeSummary, previewExpandFromNode, searchNodes } from '../graph/store'
import type { Direction, ExpandRequest } from '../graph/types'

export const graphHandlers = [
  http.get('/api/v1/graph/dictionary', () => {
    const nodeTypes = ['PERSON', 'COMPANY', 'ACCOUNT', 'LOAN', 'MEDIUM'];
    const edgeTypes = [
      'OWNS',
      'TRANSFERS_TO',
      'WITHDRAWS_TO',
      'APPLIES_FOR',
      'DEPOSITS_TO',
      'REPAYS',
      'SIGNED_IN_WITH',
      'INVESTS_IN',
      'GUARANTEES',
      'RELATED_TO',
    ];
    const relationFamilies = [
      'CUSTOMER_OWNERSHIP',
      'ACCOUNT_FLOW',
      'LOAN_FLOW',
      'SHARED_INFRASTRUCTURE',
      'LOAN_APPLICATION',
      'PERSON_GUARANTEE_PERSON',
      'COMPANY_GUARANTEE_COMPANY',
      'INVESTMENT',
      'OTHER',
    ];
    const nodeStatuses = ['BLACKLIST', 'VIP', 'HIGH_RISK'];
    const styleHints = Object.fromEntries([
      ...nodeStatuses.map((value) => [value, `legend:status:${value.toLowerCase().replaceAll('_', '-')}`]),
      ...nodeTypes.map((value) => [value, `legend:node-type:${value.toLowerCase().replaceAll('_', '-')}`]),
      ...edgeTypes.map((value) => [value, `legend:edge-type:${value.toLowerCase().replaceAll('_', '-')}`]),
      ...relationFamilies.map((value) => [value, `legend:relation-family:${value.toLowerCase().replaceAll('_', '-')}`]),
    ]);

    return HttpResponse.json({
      edgeTypes,
      relationFamilies,
      nodeTypes,
      nodeStatuses,
      styleHints,
    });
  }),

  http.get('/api/v1/graph/nodes/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') ?? '';
    const nodeType = url.searchParams.get('nodeType');
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const includeAttributes = url.searchParams.get('includeAttributes') !== 'false';
    return HttpResponse.json(searchNodes(query, nodeType, limit, includeAttributes));
  }),

  http.get('/api/v1/graph/node-summary', ({ request }) => {
    const url = new URL(request.url);
    const nodeId = url.searchParams.get('nodeId') ?? '';
    const relationFamily = url.searchParams.get('relationFamily');
    const direction = (url.searchParams.get('direction') ?? 'BOTH') as Direction;
    const summary = getNodeSummary(nodeId, relationFamily, direction);

    if (!summary) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Node not found' }, { status: 404 });
    }

    return HttpResponse.json(summary);
  }),

  http.get('/api/v1/graph/full', ({ request }) => {
    const url = new URL(request.url);
    const includeAttributes = url.searchParams.get('includeAttributes') !== 'false';
    return HttpResponse.json(getFullGraph(includeAttributes));
  }),

  http.post('/api/v1/graph/expand', async ({ request }) => {
    const body = (await request.json()) as ExpandRequest;
    return HttpResponse.json(expandFromNode(body));
  }),

  http.post('/api/v1/graph/expand/preview', async ({ request }) => {
    const body = (await request.json()) as ExpandRequest;
    return HttpResponse.json(previewExpandFromNode(body));
  }),
]
