import { Algo } from '@binance/algo';
import { Spot } from '@binance/connector-typescript';

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
const BASE_URL = 'https://api.binance.com';

export const spotClient = new Spot(API_KEY, API_SECRET, { baseURL: BASE_URL });
export const algoClient = new Algo({
    configurationRestAPI: {
        apiKey: API_KEY ?? '',
        apiSecret: API_SECRET ?? '',
        basePath: BASE_URL,
    }
});

