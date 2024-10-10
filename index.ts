import * as cheerio from "cheerio";
import * as fs from "fs";

type Store = {
    name: string;
    address: string;
    lat: number;
    lon: number;
    prefecture: number;
};

enum Game {
    Ongeki = 88,
    Maimai = 96,
    Chunithm = 109
};

async function fetchStores(gameId: Game, prefectureId: number) {
    const url = `https://location.am-all.net/alm/location?gm=${gameId}&at=${prefectureId}&ct=1000&lang=en`;
    const response = await fetch(url);
    const $ = cheerio.load(await response.text());

    const stores: [id: number, store: Store][] = [];

    $("ul.store_list li").each((index, element) => {
        const name = $(element).find("span.store_name").text().trim();
        const address = $(element).find("span.store_address").text().trim();
        const mapButton = $(element).find("button.store_bt_google_map_en").attr("onclick");
        const coordsMatch = /@([\d.]+),([\d.]+)/.exec(mapButton || "");
        const lat = coordsMatch ? parseFloat(coordsMatch[1]) : 0;
        const lon = coordsMatch ? parseFloat(coordsMatch[2]) : 0;
        const detailsButton = $(element).find("button.bt_details_en").attr("onclick");
        const idMatch = /sid=(\d+)/.exec(detailsButton || "");
        const id = idMatch ? parseInt(idMatch[1]) : 0;

        stores.push([id, { name, address, lat, lon, prefecture: prefectureId }]);
    });

    return stores;
}

async function main() {
    const stores: {
        [store_id: number]: Store
    } = {};

    const games: Record<Game, number[]> = {
        [Game.Ongeki]: [],
        [Game.Maimai]: [],
        [Game.Chunithm]: []
    };

    const promises = [];

    for (let prefectureId = 0; prefectureId < 47; prefectureId++) {
        for (const gameId of [Game.Ongeki, Game.Maimai, Game.Chunithm]) {
            promises.push(new Promise<void>(async (resolve) => {
                const result = await fetchStores(gameId, prefectureId);

                for (const storeData of result) {
                    const [id, store] = storeData;
                    stores[id] = store;
                }

                games[gameId].push(...result.map(([id]) => id).sort((a, b) => a - b));

                resolve();
            }));
        }
    }

    await Promise.all(promises);

    // Sort store IDs in games
    for (const game of Object.values(games)) {
        game.sort((a, b) => a - b);
    }
    
    fs.writeFileSync("stores.json", JSON.stringify(stores, null, 4));
    fs.writeFileSync("games.json", JSON.stringify(games, null, 4));
}

await main();
