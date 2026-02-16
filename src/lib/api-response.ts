import { NextRequest, NextResponse } from 'next/server';

export type ApiResponse<T> = {
    ok: true;
    data: T;
    meta: {
        timestamp: string;
        request_id: string;
        cursor?: string;
        has_more?: boolean;
        count?: number;
    };
};

export type ApiErrorResponse = {
    ok: false;
    error: {
        code: string;
        message: string;
        suggestion: string;
    };
    meta: {
        timestamp: string;
        request_id: string;
    };
};

export function successResponse<T>(data: T, meta: { cursor?: string; has_more?: boolean; count?: number } = {}): NextResponse<ApiResponse<T>> {
    const requestId = crypto.randomUUID();
    return NextResponse.json({
        ok: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            request_id: requestId,
            ...meta,
        },
    });
}

export function errorResponse(
    code: string,
    message: string,
    suggestion: string,
    status: number = 400
): NextResponse<ApiErrorResponse> {
    const requestId = crypto.randomUUID();
    return NextResponse.json(
        {
            ok: false,
            error: {
                code,
                message,
                suggestion,
            },
            meta: {
                timestamp: new Date().toISOString(),
                request_id: requestId,
            },
        },
        { status }
    );
}
