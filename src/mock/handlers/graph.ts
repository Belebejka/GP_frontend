import { http, HttpResponse } from 'msw'
import { expandFromNode, getExpandPreview, getRoots, searchById } from '../graph/store'
import type { ExpandRequest, SearchRequest } from '../graph/types'

export const graphHandlers = [
  http.get('/api/v1/graph/mock-roots', ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    return HttpResponse.json({
      items: getRoots(limit),
      meta: { total: limit },
    });
  }),

  http.post('/api/v1/graph/search', async ({ request }) => {
    const body = (await request.json()) as SearchRequest;
    return HttpResponse.json(searchById(body));
  }),

  http.post('/api/v1/graph/expand-preview', async ({ request }) => {
    const body = (await request.json()) as ExpandRequest;
    return HttpResponse.json(getExpandPreview(body));
  }),

  http.post('/api/v1/graph/expand', async ({ request }) => {
    const body = (await request.json()) as ExpandRequest;
    return HttpResponse.json(expandFromNode(body));
  }),
]