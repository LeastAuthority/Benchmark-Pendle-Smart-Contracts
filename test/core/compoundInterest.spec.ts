import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract, Wallet } from "ethers";
import {
  approxBigNumber,
  getCContract,
  consts,
  evm_revert,
  evm_snapshot,
  mintCompoundToken,
  setTimeNextBlock,
  Token,
  tokens,
  amountToWei,
  mint,
  getERC20Contract,
} from "../helpers";
import testData from "./fixtures/yieldTokenizeAndRedeem.scenario.json";
import { pendleFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

interface YieldTest {
  type: string;
  user: number;
  amount: number;
  timeDelta: number;
}

describe("compoundInterest test", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave, eve] = wallets;

  let router: Contract;
  let cOt: Contract;
  let cUSDT: Contract;
  let cForge: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleFixture);
    router = fixture.core.router;
    cOt = fixture.cForge.cOwnershipToken;
    tokenUSDT = tokens.USDT;
    cForge = fixture.cForge.compoundForge;
    cUSDT = await getCContract(alice, tokenUSDT);

    await mintCompoundToken(
      provider,
      tokens.USDT,
      bob,
      consts.INITIAL_COMPOUND_TOKEN_AMOUNT
    );
    await mintCompoundToken(
      provider,
      tokens.USDT,
      charlie,
      consts.INITIAL_COMPOUND_TOKEN_AMOUNT
    );
    await mintCompoundToken(
      provider,
      tokens.USDT,
      dave,
      consts.INITIAL_COMPOUND_TOKEN_AMOUNT
    );
    await cUSDT.connect(bob).approve(router.address, consts.MAX_ALLOWANCE);
    await cUSDT.connect(charlie).approve(router.address, consts.MAX_ALLOWANCE);

    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function redeemDueInterests(user: Wallet) {
    await router
      .connect(user)
      .redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function redeemUnderlying(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .redeemUnderlying(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        amount,
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function tokenizeYield(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .tokenizeYield(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        amount,
        user.address,
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function addFakeIncome(token: Token, user: Wallet, amount: BN) {
    await mint(provider, token, user, amount);
    let USDTcontract = await getERC20Contract(user, token);
    USDTcontract.connect(user).transfer(
      cUSDT.address,
      amountToWei(amount, token.decimal)
    );
  }

  async function runTest(yieldTest: YieldTest[]) {
    let curTime = consts.T0;
    for (let id = 0; id < yieldTest.length; id++) {
      let curTest = yieldTest[id];
      let user = wallets[curTest.user];
      curTime = curTime.add(BN.from(curTest.timeDelta));
      // console.log(id, "/", yieldTest.length, BN.from(curTest.timeDelta));
      await setTimeNextBlock(provider, curTime);
      if (curTest.type == "redeemDueInterests") {
        await redeemDueInterests(user);
      } else if (curTest.type == "redeemUnderlying") {
        await redeemUnderlying(user, BN.from(curTest.amount));
      } else if (curTest.type == "tokenizeYield") {
        await tokenizeYield(user, BN.from(curTest.amount));
      } else if (curTest.type == "redeemUnderlyingAll") {
        let balance = await cOt.balanceOf(user.address);
        await redeemUnderlying(user, balance);
      }
      await addFakeIncome(
        tokens.USDT,
        eve,
        consts.INITIAL_COMPOUND_TOKEN_AMOUNT.mul(100)
      );
    }
    await cUSDT.balanceOfUnderlying(cForge.address);
    await cUSDT.balanceOfUnderlying(alice.address);
    await cUSDT.balanceOfUnderlying(bob.address);
    await cUSDT.balanceOfUnderlying(dave.address);
    await cUSDT.balanceOfUnderlying(charlie.address);

    // console.log("cTokenBalance of forge", (await cUSDT.callStatic.balanceOfUnderlying(cForge.address)));
    // await cUSDT.connect(alice).redeem(amountToWei(consts.INITIAL_COMPOUND_TOKEN_AMOUNT, tokenUSDT.decimal));
    // await cUSDT.connect(bob).redeem(amountToWei(consts.INITIAL_COMPOUND_TOKEN_AMOUNT, tokenUSDT.decimal));
    // await cUSDT.connect(charlie).redeem(amountToWei(consts.INITIAL_COMPOUND_TOKEN_AMOUNT, tokenUSDT.decimal));
    // await cUSDT.connect(dave).redeem(amountToWei(consts.INITIAL_COMPOUND_TOKEN_AMOUNT, tokenUSDT.decimal));
    const expectedBalance = await cUSDT.callStatic.balanceOfUnderlying(
      dave.address
    );
    approxBigNumber(
      await cUSDT.callStatic.balanceOfUnderlying(alice.address),
      expectedBalance,
      BN.from(100000)
    );
    approxBigNumber(
      await cUSDT.callStatic.balanceOfUnderlying(bob.address),
      expectedBalance,
      BN.from(100000)
    );
    approxBigNumber(
      await cUSDT.callStatic.balanceOfUnderlying(charlie.address),
      expectedBalance,
      BN.from(100000)
    );
  }
  it("test 1", async () => {
    await runTest((<any>testData).test1);
  });
  it("test 2", async () => {
    await runTest((<any>testData).test2);
  });

  xit("stress 1 [only enable when necessary]", async () => {
    await runTest((<any>testData).stress1);
  });
  xit("stress 2 [only enable when necessary]", async () => {
    await runTest((<any>testData).stress2);
  });
});
