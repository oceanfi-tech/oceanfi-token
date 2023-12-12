const dotenv = require("dotenv");
dotenv.config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");
require("solidity-coverage");

const { PRIVATE_KEY } = process.env;
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        bscTestnet: {
            url: "https://data-seed-prebsc-1-s3.binance.org:8545/",
            chainId: 97,
            gasPrice: 10000000000,
            accounts: [`0x${PRIVATE_KEY}`],
        },
        bsc: {
            url: "https://bsc-mainnet.nodereal.io/v1/4d2227084aca424791d28f9eae0e1d59",
            chainId: 56,
            // gasPrice: 20000000000,
            accounts: [`0x${PRIVATE_KEY}`],
        },
    },
    solidity: {
        version: "0.8.8",
        settings: {
            optimizer: {
                enabled: true,
            },
        },
    },
    etherscan: {
        apiKey: {
            //bsc
            bscTestnet: process.env.API_BSCSCAN,
            bsc: process.env.API_BSCSCAN,
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    mocha: {
        timeout: 2000000,
    },
    gasReporter: {
        enable: true,
        currency: "USD",
        gasPrice: 21,
    },
};
