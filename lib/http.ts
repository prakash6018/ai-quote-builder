export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => Response.json({ error: { message, ...extra } }, { status });
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
