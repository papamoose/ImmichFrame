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
	['Old Family Photos', 0, 24, false],
	['Birthday Party 2024', 3, 8, true],
	['Christmas Morning', 0, 4, false],
	['Camping Trip', 9, 15, false],
	['Dog Park', 15, 19, false],
	['Thanksgiving', 18, 23, true],
	['Wedding Anniversary', 1, 5, false]
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
// Which photos carry each tag. `name` is the full path (real Immich uses the last segment)
// because the frame shows it as the photo's tag label, and the full path reads better.
const tagDefs = [
	['Birthday', 3, 8],
	['Holiday', 0, 6],
	['Family/Kids', 12, 17],
	['Family/Pets', 15, 19],
	['Travel/Utah', 21, 24],
	['Vacation', 6, 15]
];
const tags = tagDefs.map(([value, from, to], i) => ({
	id: uuid('7a9', i + 1),
	name: value,
	value,
	range: [from, to],
	createdAt: NOW,
	updatedAt: NOW
}));

// Star rating of photo n (1-5), so the rating filter has something to filter.
const ratingOf = (n) => (n % 5) + 1;

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
		thumbhash: '3OcRJYB4d3h/iIeHeEh3eIhw+j3A', // a valid placeholder hash; null renders a broken image in the frame
		type: 'IMAGE',
		visibility: 'timeline',
		exifInfo: {
			city,
			state,
			country: 'United States',
			dateTimeOriginal: `2025-${String((n % 12) + 1).padStart(2, '0')}-14T15:30:00.000Z`,
			description: '',
			rating: ratingOf(n)
		},
		people: [people[n % people.length]],
		tags: tags.filter((t) => n >= t.range[0] && n < t.range[1]).map(({ range, ...t }) => t)
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

// Photos matching ImmichFrame's search filter: the `or` branches (albums / people / tags)
// are unioned, `albumIds.none` (hidden albums) is subtracted, `rating.gte` is a minimum star rating. Other fields are ignored.
function matching(filter = {}) {
	const all = [...Array(ASSET_COUNT).keys()];
	const inAlbums = (ids) =>
		new Set(albums.filter((a) => ids.includes(a.id)).flatMap((a) => range(...a.range)));
	let ids = all;
	if (filter.or?.length) {
		const keep = new Set();
		for (const branch of filter.or) {
			if (branch.albumIds?.any) inAlbums(branch.albumIds.any).forEach((n) => keep.add(n));
			if (branch.personIds?.any)
				all.filter((n) => branch.personIds.any.includes(people[n % people.length].id)).forEach((n) => keep.add(n));
			if (branch.tagIds?.any)
				tags
					.filter((t) => branch.tagIds.any.includes(t.id))
					.forEach((t) => range(...t.range).forEach((n) => keep.add(n)));
		}
		ids = all.filter((n) => keep.has(n));
	}
	if (typeof filter.rating?.gte === 'number') ids = ids.filter((n) => ratingOf(n) >= filter.rating.gte);
	if (filter.albumIds?.none?.length) {
		const hidden = inAlbums(filter.albumIds.none);
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
		if (p === '/tags') return json(res, tags.map(({ range, ...t }) => t));
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
			return json(res, { total: matching(body.filter).length });
		}
		if (p === '/search/random') {
			const body = await readBody(req);
			const pool = matching(body.filter);
			const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, body.size ?? 10);
			return json(res, shuffled.map(asset));
		}
		if (p === '/search/memories' || p === '/memories') return json(res, []);
		if (p.endsWith('/faces') || p === '/faces') return json(res, []);
		json(res, { message: `mock-immich: unhandled ${req.method} ${p}` }, 404);
	})
	.listen(PORT, () => console.log(`mock-immich listening on :${PORT}, images from ${IMAGES}`));
