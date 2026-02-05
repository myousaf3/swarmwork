import { NextRequest, NextResponse } from 'next/server';
import { hashApiKey, validateApiKeyFormat } from './lib/auth/agent-auth';
import { db } from './lib/db';
import { agents } from './lib/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse } from './lib/api-response';
import { checkRateLimit, setRateLimitHeaders } from './lib/rate-limit';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Agent API Auth (/api/v1/*)
    if (pathname.startsWith('/api/v1/')) {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(
                'UNAUTHORIZED',
                'Missing or invalid Authorization header',
                'Include header: Authorization: Bearer th_agent_<your-key>',
                401
            );
        }

        const token = authHeader.substring(7);
        if (!validateApiKeyFormat(token)) {
            return errorResponse(
                'UNAUTHORIZED',
                'Invalid API key format',
                'Check your API key format (th_agent_ + 64 hex characters)',
                401
            );
        }

        const hash = await hashApiKey(token);
        const [agent] = await db.select().from(agents).where(eq(agents.apiKeyHash, hash)).limit(1);

        if (!agent) {
            return errorResponse(
                'UNAUTHORIZED',
                'Invalid API key',
                'Check your API key or generate a new one at /dashboard/agents',
                401
            );
        }

        if (agent.status !== 'active') {
            const suggestion = agent.status === 'paused'
                ? 'Resume your agent in the dashboard'
                : 'Contact support (agent is suspended)';
            return errorResponse(
                'FORBIDDEN',
                `Agent is ${agent.status}`,
                suggestion,
                403
            );
        }

        // Rate limiting
        const rateLimitResult = checkRateLimit(hash);
        if (!rateLimitResult.allowed) {
            const resp = errorResponse(
                'RATE_LIMITED',
                'Too many requests',
                `Rate limit is ${rateLimitResult.limit} requests per minute. Retry after ${new Date(rateLimitResult.resetMs).toISOString()}`,
                429
            );
            setRateLimitHeaders(resp.headers, rateLimitResult);
            return resp;
        }

        // Attach agent ID to headers for route handlers to pick up
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-agent-id', agent.id.toString());
        requestHeaders.set('x-operator-id', agent.operatorId.toString());

        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });

        // Set rate limit headers on all API responses
        setRateLimitHeaders(response.headers, rateLimitResult);

        return response;
    }

    // 2. Human Dashboard Auth (/dashboard*)
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        const sessionCookie = request.cookies.get('auth_session');
        if (!sessionCookie) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const runtime = 'nodejs';

export const config = {
    matcher: ['/api/v1/:path*', '/dashboard', '/dashboard/:path*'],
};
