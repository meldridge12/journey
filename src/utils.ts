import type { AstroCookies, AstroGlobal } from 'astro';
import { type Account, getAccount, auth, AccountType } from './api.js';
import { createHash } from 'node:crypto';

export function hash(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

export async function currentUser(cookies: AstroCookies): Promise<Account | undefined> {
	if (!cookies.has('token')) {
		return;
	}
	const token = cookies.get('token')?.value;
	auth(token);
	try {
		return await getAccount('token', token || '');
	} catch (e) {
		return;
	}
}

export async function parseBody<V extends Record<string, FormDataEntryValue>>(request: Request): Promise<V> {
	switch (request.headers.get('Content-Type')) {
		case 'application/json':
			return await request.json();
		case 'application/x-www-form-urlencoded':
			const formData = await request.formData();
			return Object.fromEntries(formData.entries()) as V;
		default:
			const text = await request.text();
			return JSON.parse(text);
	}
}

export function checkParams<B extends Record<string, unknown>>(body: B, ...params: (keyof B & string)[]): void {
	if (typeof body != 'object') {
		throw 'Invalid request body';
	}
	for (const param of params) {
		if (!(param in body)) {
			throw 'Missing in body: ' + param;
		}
	}
}

/**
 * Merges object intersection T.
 * A function type is used so that editors expand the type.
 */
type Merge<T> = ReturnType<() => { [K in keyof T]: T[K] }>;

export async function checkBody<const B>(request: Request, ...params: (keyof B & string)[]): Promise<Partial<Merge<B>>> {
	const contentType = request.headers.get('Content-Type') ?? '';
	if (request.headers.has('Content-Type') && !['text/json', 'application/json'].includes(contentType)) {
		throw 'Content-Type "' + contentType + '" not supported';
	}
	let body: Partial<Merge<B>>;
	try {
		body = await request.json();
	} catch (e) {
		throw 'Missing request body';
	}

	checkParams(body, ...params);
	return body;
}

export async function checkAdminAuth(astro: Readonly<AstroGlobal>, minType?: AccountType): Promise<Account | Response> {
	const account = await currentUser(astro.cookies);

	minType ||= 1; // to prevent 0 from being passed

	if (!account) {
		return astro.redirect('/login');
	}

	if (account.type < minType) {
		astro.response.status = 403;
	}

	return account;
}
