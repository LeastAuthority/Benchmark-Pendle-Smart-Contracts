import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import {
  amountToWei,
  consts,
  evm_revert,
  evm_snapshot,
  setTimeNextBlock,
  Token,
  tokens,
} from "../helpers";
import { pendleMarketFixture } from "./fixtures";

const { waffle } = require("hardhat");
const { provider } = waffle;

describe("AMM Formula", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  let pendle: Contract;
  let pendleXyt: Contract;
  let pendleMarket: Contract;
  let testToken: Contract;
  let tokenUSDT: Token;
  let snapshotId: string;
  let globalSnapshotId: string;
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(pendleMarketFixture);
    pendle = fixture.core.pendle;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    testToken = fixture.testToken;
    pendleMarket = fixture.pendleMarket;
    tokenUSDT = tokens.USDT;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  async function bootstrapSampleMarket(
    amountToTokenize: BN,
    lowLevelCall: boolean = false
  ) {
    await pendle.bootStrapMarket(
      // TODO: Rename to bootstrap when merge with Anton's new code
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function swapTokenToXyt(amount: BN) {
    await pendle.swapTokenToXyt(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function swapXytToToken(amount: BN) {
    await pendle.swapXytToToken(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amount,
      BN.from(0),
      consts.MAX_ALLOWANCE
    );
  }

  async function runTestTokenToXyt(time: BN, tokenIn: BN, xytOut: BN) {
    var {
      xytReserves: initialXytReserves,
      tokenReserves: initialTokenReserves,
    } = await pendleMarket.getReserves();

    await setTimeNextBlock(provider, time);
    await swapTokenToXyt(tokenIn);
    var { xytReserves, tokenReserves } = await pendleMarket.getReserves();

    var actualXytOut = initialXytReserves.sub(xytReserves);
    var actualTokenIn = tokenReserves.sub(initialTokenReserves);

    console.log("diff:", tokenIn.sub(actualTokenIn).toNumber());
    console.log("diff:", xytOut.sub(actualXytOut).toNumber());
    expect(tokenIn.toNumber()).to.be.approximately(
      actualTokenIn.toNumber(),
      consts.AMM_DELTA
    );
    expect(xytOut.toNumber()).to.be.approximately(
      actualXytOut.toNumber(),
      consts.AMM_DELTA
    );
  }

  async function runTestXytToToken(time: BN, xytIn: BN, tokenOut: BN) {
    var {
      xytReserves: initialXytReserves,
      tokenReserves: initialTokenReserves,
    } = await pendleMarket.getReserves();

    await setTimeNextBlock(provider, time);
    await swapXytToToken(xytIn);
    var { xytReserves, tokenReserves } = await pendleMarket.getReserves();

    var actualXytIn: BN = xytReserves.sub(initialXytReserves);
    var actualTokenOut: BN = initialTokenReserves.sub(tokenReserves);

    console.log("diff:", tokenOut.sub(actualTokenOut).toNumber());
    console.log("diff:", xytIn.sub(actualXytIn).toNumber());
    expect(tokenOut.toNumber()).to.be.approximately(
      actualTokenOut.toNumber(),
      consts.AMM_DELTA
    );
    expect(xytIn.toNumber()).to.be.approximately(
      actualXytIn.toNumber(),
      consts.AMM_DELTA
    );
  }

  it("Test 1", async () => {
    const amountToTokenize = amountToWei(tokenUSDT, BN.from(1000));
    await bootstrapSampleMarket(amountToTokenize);
    await testToken.approve(pendleMarket.address, consts.MAX_ALLOWANCE);

    await runTestTokenToXyt(
      consts.T0.add(3600),
      BN.from(20405615),
      BN.from(20000000)
    );
    await runTestXytToToken(
      consts.T0.add(3660),
      BN.from(120000000),
      BN.from(111303781)
    );
    await runTestTokenToXyt(
      consts.T0.add(43200),
      BN.from(300000000),
      BN.from(273280448)
    );
    await runTestXytToToken(
      consts.T0.add(43210),
      BN.from(74655258),
      BN.from(100000000)
    );
    await runTestXytToToken(
      consts.T0.add(2592030),
      BN.from(100000000),
      BN.from(100716340)
    );
    await runTestXytToToken(
      consts.T0.add(14515300),
      BN.from(200000000),
      BN.from(24266823)
    );
    await runTestTokenToXyt(
      consts.T0.add(14861000),
      BN.from(26338047),
      BN.from(300000000)
    );
    await runTestXytToToken(
      consts.T0.add(15120300),
      BN.from(400000000),
      BN.from(21595046)
    );
    await runTestTokenToXyt(
      consts.T0.add(15120360),
      BN.from(3696839),
      BN.from(80000000)
    );
    await runTestXytToToken(
      consts.T0.add(15551400),
      BN.from(800000000),
      BN.from(42635)
    );
  });
});
