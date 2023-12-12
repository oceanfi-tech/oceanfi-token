const { expect } = require("chai");
const { parseUnits, formatUnits, formatEther, parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");
require("dotenv").config();
require("@nomicfoundation/hardhat-chai-matchers");

const CONTRACT_NAME = "OceanFiToken";
const TOKEN_NAME = "Oceanfi";
const TOKEN_SYMBOL = "OCF";
const TOKEN_DECIMAL = 18;
const TOTAL_SUPPLY = 28_000_000;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ONE_DAY = 24 * 60 * 60;

const waitTransaction = async (transactionFunc) => {
    const tx = await transactionFunc;
    return await tx.wait();
};

describe("Test Token", () => {
    let tokenContract, oracleContract;
    let owner, account, pancakeLp, locker, unlocker, account2;

    beforeEach(async () => {
        [owner, account, pancakeLp, locker, unlocker, account2] = await ethers.getSigners();
        const TokenContract = await ethers.getContractFactory(CONTRACT_NAME, owner);
        tokenContract = await TokenContract.deploy();

        const Oracle = await ethers.getContractFactory("OracleTest", owner);
        oracleContract = await Oracle.deploy(
            ZERO_ADDR, //pair
            ZERO_ADDR, //stable
            tokenContract.address //tokenContract
        );

        const tx = await tokenContract.connect(owner).setOracle(oracleContract.address);
        await tx.wait();
    });

    describe.skip("Token info", () => {
        it("should have the correct name", async () => {
            expect(await tokenContract.name()).to.equal(TOKEN_NAME);
        });

        it("should have the correct symbol", async () => {
            expect(await tokenContract.symbol()).to.equal(TOKEN_SYMBOL);
        });

        it("should have the correct decimals", async () => {
            expect(await tokenContract.decimals()).to.equal(TOKEN_DECIMAL);
        });

        it("should have the correct initial balance for the owner", async () => {
            const totalOwnerBalance = await tokenContract.balanceOf(owner.address);
            const totalSupply = parseUnits(TOTAL_SUPPLY.toString(), TOKEN_DECIMAL);
            expect(totalOwnerBalance).to.equal(totalSupply);
        });
    });

    describe.skip("Transfer", () => {
        it("should be able to transfer tokens", async () => {
            const transferAmount = parseUnits("100", TOKEN_DECIMAL);
            await tokenContract.connect(owner).transfer(account.address, transferAmount);
            const accountBalance = await tokenContract.balanceOf(account.address);
            expect(accountBalance).to.equal(transferAmount);
        });

        describe("Limit Transfer", () => {
            const sellLimit = 100; // 100$
            const buyLimit = 150; // 150$

            beforeEach(async () => {
                const tokenWriteable = await tokenContract.connect(owner);
                const transaction1 = await tokenWriteable.setSellLimit(parseEther(sellLimit.toString()));
                await transaction1.wait();
                const transaction2 = await tokenWriteable.setBuyLimit(parseEther(buyLimit.toString()));
                await transaction2.wait();
                const transaction3 = await tokenWriteable.setPancakeLp(pancakeLp.address, true);
                await transaction3.wait();
                const transaction4 = await tokenWriteable.setAddressExcludeLimit(owner.address, true);
                await transaction4.wait();
                const transaction5 = await tokenWriteable.transfer(account.address, parseEther("1000000"));
                await transaction5.wait();
                const transaction6 = await tokenWriteable.transfer(pancakeLp.address, parseEther("1000000"));
                await transaction6.wait();
            });

            it("Sell limit", async () => {
                const timestamp = await time.latest();
                const nowDate = new Date(timestamp * 1000);
                nowDate.setUTCHours(0, 0, 0, 0);
                const now = Math.round(nowDate / 1000);

                await tokenContract.connect(account).transfer(pancakeLp.address, parseEther("100"));
                await tokenContract.connect(account).transfer(pancakeLp.address, parseEther("50"));
                await expect(
                    tokenContract.connect(account).transfer(pancakeLp.address, parseEther("1"))
                ).to.be.revertedWith("BEATGEN_TOKEN: SELL LIMIT");

                const nextDay = now + ONE_DAY;
                await time.increaseTo(nextDay - 2);
                await expect(
                    tokenContract.connect(account).transfer(pancakeLp.address, parseEther("1"))
                ).to.be.revertedWith("BEATGEN_TOKEN: SELL LIMIT");

                await time.increaseTo(nextDay);
                await tokenContract.connect(account).transfer(pancakeLp.address, parseEther("150"));
            });

            it("Buy limit", async () => {
                const timestamp = await time.latest();
                const nowDate = new Date(timestamp * 1000);
                nowDate.setUTCHours(0, 0, 0, 0);
                const now = Math.round(nowDate / 1000);

                await tokenContract.connect(pancakeLp).transfer(account.address, parseEther("200"));
                await tokenContract.connect(pancakeLp).transfer(account.address, parseEther("25"));
                await expect(
                    tokenContract.connect(pancakeLp).transfer(account.address, parseEther("1"))
                ).to.be.revertedWith("BEATGEN_TOKEN: BUY LIMIT");

                const nextDay = now + ONE_DAY;
                await time.increaseTo(nextDay - 2);
                await expect(
                    tokenContract.connect(pancakeLp).transfer(account.address, parseEther("1"))
                ).to.be.revertedWith("BEATGEN_TOKEN: BUY LIMIT");

                await time.increaseTo(nextDay);
                await tokenContract.connect(pancakeLp).transfer(account.address, parseEther("225"));
            });
        });
    });

    describe("Lock token", () => {
        beforeEach(async () => {
            const tokenWriteable = tokenContract.connect(owner);
            await waitTransaction(tokenWriteable.setLocker(locker.address, true));
            await waitTransaction(tokenWriteable.setUnlocker(unlocker.address, true));
            await waitTransaction(tokenWriteable.transfer(account.address, parseEther("100")));
            await waitTransaction(tokenWriteable.transfer(locker.address, parseEther("1000")));
        });

        it("should be lock", async () => {
            const lockedValue = parseEther("50");

            const oldBalance = await tokenContract.balanceOf(account.address);
            await waitTransaction(tokenContract.connect(locker).transfer(account.address, lockedValue));
            const balance = await tokenContract.balanceOf(account.address);
            expect(balance).to.equal(oldBalance.add(lockedValue));

            await expect(
                tokenContract.connect(account).transfer(account2.address, balance)
            ).to.be.revertedWith("ERC20: Not enough balance!");

            await waitTransaction(tokenContract.connect(account).transfer(account2.address, oldBalance));
            const afterTransferBalance = await tokenContract.balanceOf(account.address);
            expect(afterTransferBalance).to.equal(lockedValue);
        });

        it("should be unlock", async () => {
            const lockedValue = parseEther("50");
            const unlockValue = parseEther("15");

            const oldBalance = await tokenContract.balanceOf(account.address);
            await waitTransaction(tokenContract.connect(locker).transfer(account.address, lockedValue));
            const balance = await tokenContract.balanceOf(account.address);
            expect(balance).to.equal(oldBalance.add(lockedValue));
            await waitTransaction(tokenContract.connect(unlocker).unlockBalance(account.address, unlockValue));

            await expect(
                tokenContract.connect(account).transfer(account2.address, balance)
            ).to.be.revertedWith("ERC20: Not enough balance!");

            await waitTransaction(tokenContract.connect(account).transfer(account2.address, oldBalance.add(unlockValue)));
            const afterTransferBalance = await tokenContract.balanceOf(account.address);
            expect(afterTransferBalance).to.equal(lockedValue.sub(unlockValue));
        });
    });

    describe.skip("Burn", () => {
        it("should be burnable", async () => {
            const burnAmount = parseUnits("10000", TOKEN_DECIMAL);
            await tokenContract.connect(owner).burn(burnAmount);
            const remainingAmount = parseUnits(TOTAL_SUPPLY.toString(), TOKEN_DECIMAL).sub(burnAmount);
            const totalSupply = await tokenContract.totalSupply();
            const totalOwnerBalance = await tokenContract.balanceOf(owner.address);
            expect(totalSupply).to.equal(remainingAmount);
            expect(totalOwnerBalance).to.equal(remainingAmount);
        });

        it("Burn when limit swap", async () => {
            const sellLimit = 100; // 100$
            const buyLimit = 150; // 150$
            const tokenWriteable = tokenContract.connect(owner);
            const transaction1 = await tokenWriteable.setSellLimit(parseEther(sellLimit.toString()));
            await transaction1.wait();
            const transaction2 = await tokenWriteable.setBuyLimit(parseEther(buyLimit.toString()));
            await transaction2.wait();
            const transaction3 = await tokenWriteable.setPancakeLp(pancakeLp.address, true);
            await transaction3.wait();
            const transaction4 = await tokenWriteable.setAddressExcludeLimit(owner.address, true);
            await transaction4.wait();

            const burnAmount = parseUnits("10000", TOKEN_DECIMAL);
            await tokenContract.connect(owner).burn(burnAmount);
            const remainingAmount = parseUnits(TOTAL_SUPPLY.toString(), TOKEN_DECIMAL).sub(burnAmount);
            const totalSupply = await tokenContract.totalSupply();
            const totalOwnerBalance = await tokenContract.balanceOf(owner.address);
            expect(totalSupply).to.equal(remainingAmount);
            expect(totalOwnerBalance).to.equal(remainingAmount);
        });
    });
});
