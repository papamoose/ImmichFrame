// Minimal fake Immich server: just the endpoints ImmichFrame calls, backed by the
// generated images in IMAGES_DIR. Lets the screenshots be reproduced without a real
// Immich instance or real family photos. Dependency-free on purpose (runs in node:22-slim).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 2283);
const IMAGES = process.env.IMAGES_DIR ?? path.join(import.meta.dirname, '.cache', 'images');

const uuid = (kind, n) =>
	`${kind}${String(n).padStart(3, '0')}`.padEnd(8, '0') + `-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = '2026-06-01T12:00:00.000Z';

// 24 photos; albums own consecutive slices of them (cover = first photo).
const ASSET_COUNT = 24;
const albumDefs = [
	['Family Christmas 2025', 0, 6, true],
	['Summer at the Lake', 6, 12, false],
	['Grandkids', 12, 17, true],
	['Garden Projects', 17, 21, false],
	['Road Trip to Utah', 21, 24, true],
	['Old Family Photos', 0, 24, false]
];
const albums = albumDefs.map(([albumName, from, to, shared], i) => ({
	id: uuid('a1b', i + 1),
	albumName,
	albumThumbnailAssetId: uuid('ca5', from),
	assetCount: to - from,
	shared,
	range: [from, to],
	albumUsers: [],
	createdAt: NOW,
	updatedAt: NOW,
	description: '',
	hasSharedLink: false,
	isActivityEnabled: false
}));
const people = ['Mom', 'Dad', 'Grandma Rose', 'Emma', 'Lucas', 'Sophie'].map((name, i) => ({
	id: uuid('9e1', i + 1),
	name,
	birthDate: null,
	isHidden: false,
	thumbnailPath: ''
}));
const tags = ['Birthday', 'Holiday', 'Family/Kids', 'Family/Pets', 'Travel/Utah', 'Vacation'].map((value, i) => ({
	id: uuid('7a9', i + 1),
	name: value.split('/').pop(),
	value,
	createdAt: NOW,
	updatedAt: NOW
}));

const assetIndex = (id) => (id.startsWith('ca5') ? Number(id.split('-').pop()) : -1);
const assetId = (n) => uuid('ca5', n);
const cities = [
	['Park City', 'Utah'],
	['Boise', 'Idaho'],
	['Denver', 'Colorado'],
	['Austin', 'Texas']
];

function asset(n) {
	const [city, state] = cities[n % cities.length];
	return {
		id: assetId(n),
		checksum: `checksum${n}`,
		createdAt: NOW,
		updatedAt: NOW,
		fileCreatedAt: NOW,
		fileModifiedAt: NOW,
		localDateTime: `2025-${String((n % 12) + 1).padStart(2, '0')}-14T15:30:00.000Z`,
		duration: 0,
		hasMetadata: true,
		height: 1067,
		width: 1600,
		isArchived: false,
		isEdited: false,
		isFavorite: false,
		isOffline: false,
		isTrashed: false,
		originalFileName: `IMG_${1000 + n}.jpg`,
		originalPath: `/photos/IMG_${1000 + n}.jpg`,
		ownerId: uuid('0a1', 1),
		thumbhash: null,
		type: 'IMAGE',
		visibility: 'timeline',
		exifInfo: {
			city,
			state,
			country: 'United States',
			dateTimeOriginal: `2025-${String((n % 12) + 1).padStart(2, '0')}-14T15:30:00.000Z`,
			description: ''
		},
		people: [people[n % people.length]]
	};
}

const json = (res, body, status = 200) => {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
};
const image = (res, file) => {
	const p = path.join(IMAGES, file);
	if (!fs.existsSync(p)) return json(res, { message: 'not found' }, 404);
	res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=60' });
	fs.createReadStream(p).pipe(res);
};
const readBody = (req) =>
	new Promise((resolve) => {
		let data = '';
		req.on('data', (c) => (data += c));
		req.on('end', () => resolve(data ? JSON.parse(data) : {}));
	});

// Photos matching a search filter. Albums narrow the pool; the rest of the filter is ignored.
function matching(filter = {}) {
	let ids = [...Array(ASSET_COUNT).keys()];
	if (filter.albumIds?.length) {
		const owned = new Set(
			albums.filter((a) => filter.albumIds.includes(a.id)).flatMap((a) => range(...a.range))
		);
		ids = ids.filter((n) => owned.has(n));
	}
	if (filter.excludedAlbumIds?.length) {
		const hidden = new Set(
			albums.filter((a) => filter.excludedAlbumIds.includes(a.id)).flatMap((a) => range(...a.range))
		);
		ids = ids.filter((n) => !hidden.has(n));
	}
	return ids;
}
const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i);

http
	.createServer(async (req, res) => {
		const url = new URL(req.url, 'http://x');
		const p = url.pathname.replace(/^\/api/, '');
		console.log(req.method, req.url);
		let m;
		if (p === '/server/version') return json(res, { major: 3, minor: 2, patch: 1, prerelease: null });
		if (p === '/albums') return json(res, albums.map(({ range, ...a }) => a));
		if (p === '/tags') return json(res, tags);
		if (p === '/people')
			return json(res, { people, total: people.length, hidden: 0, hasNextPage: false });
		if ((m = p.match(/^\/people\/[^/]+\/thumbnail$/)))
			return image(res, `person-${people.findIndex((x) => p.includes(x.id))}.jpg`);
		if ((m = p.match(/^\/assets\/([^/]+)\/(thumbnail|original)$/))) {
			const n = assetIndex(m[1]);
			return n < 0 ? json(res, {}, 404) : image(res, `asset-${n}.jpg`);
		}
		if ((m = p.match(/^\/assets\/([^/]+)$/))) {
			const n = assetIndex(m[1]);
			return n < 0 ? json(res, {}, 404) : json(res, asset(n));
		}
		if (p === '/search/statistics') {
			const body = await readBody(req);
			return json(res, { total: matching(body).length });
		}
		if (p === '/search/random') {
			const body = await readBody(req);
			const pool = matching(body);
			const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, body.size ?? 10);
			return json(res, shuffled.map(asset));
		}
		if (p === '/search/memories' || p === '/memories') return json(res, []);
		if (p.endsWith('/faces') || p === '/faces') return json(res, []);
		json(res, { message: `mock-immich: unhandled ${req.method} ${p}` }, 404);
	})
	.listen(PORT, () => console.log(`mock-immich listening on :${PORT}, images from ${IMAGES}`));
