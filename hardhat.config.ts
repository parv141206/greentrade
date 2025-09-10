import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const GANACHE_URL = process.env.GANACHE_URL || "http://127.0.0.1:7545";
const GANACHE_PRIVATE_KEY = process.env.GANACHE_PRIVATE_KEY;

export default {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  defaultNetwork: "ganache",
  networks: {
    hardhat: {},
    ganache: {
      url: GANACHE_URL,
      accounts: GANACHE_PRIVATE_KEY ? [GANACHE_PRIVATE_KEY] : [],
    },
  },
};
