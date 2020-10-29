const BN = web3.utils.BN;
const {time} = require('@openzeppelin/test-helpers');

const BenchmarkProvider = artifacts.require('BenchmarkProvider');
const Benchmark = artifacts.require('Benchmark');
const BenchmarkFactory = artifacts.require('BenchmarkFactory');
const BenchmarkForge = artifacts.require('BenchmarkForge');
const BenchmarkTreasury = artifacts.require('BenchmarkTreasury');
const BenchmarkOwnershipToken = artifacts.require('BenchmarkOwnershipToken');
const BenchmarkFutureYieldToken = artifacts.require('BenchmarkFutureYieldToken');

const {constants} = require('./Constants');
const {getAaveContracts, mintUSDT, mintAUSDT, printAaveAddressDetails} = require('./AaveHelpers');
const {getTokenAmount} = require('./Math');

// governanceAddress should be an unlocked address
async function deployContracts(governanceAddress) {
  const contracts = {};

  contracts.benchmarkProvider = await BenchmarkProvider.new(governanceAddress);
  await contracts.benchmarkProvider.addMaintainer(governanceAddress, { from: governanceAddress });

  await contracts.benchmarkProvider.setAaveAddress(constants.AAVE_LENDING_POOL_CORE_ADDRESS);
  console.log(`\t\tDeployed and setup BenchmarkProvider contract at ${contracts.benchmarkProvider.address}`);

  contracts.benchmark = await Benchmark.new(governanceAddress);
  console.log(`\t\tDeployed Benchmark contract at ${contracts.benchmark.address}`);

  contracts.benchmarkTreasury = await BenchmarkTreasury.new(governanceAddress);

  contracts.benchmarkFactory = await BenchmarkFactory.new(
    governanceAddress,
    contracts.benchmarkTreasury.address,
    contracts.benchmarkProvider.address
  );
  console.log(`\t\tDeployed BenchmarkFactory contract at ${contracts.benchmarkFactory.address}`);
  await contracts.benchmarkFactory.initialize(contracts.benchmark.address);
  await contracts.benchmark.initialize(contracts.benchmarkFactory.address);

  console.log(`\t\tInitialised BenchmarkFactory and Benchmark contracts`);

  await contracts.benchmarkFactory.createForge(constants.USDT_ADDRESS);
  const forgeAddress = await contracts.benchmarkFactory.getForge.call(constants.USDT_ADDRESS);
  console.log(`\t\tDeployed USDT forge contract at ${forgeAddress}`);
  contracts.benchmarkForge = await BenchmarkForge.at(forgeAddress);

  await contracts.benchmarkForge.newYieldContracts(constants.DURATION_ONEYEAR, constants.TEST_EXPIRY);
  const otTokenAddress = await contracts.benchmarkForge.otTokens.call(
    constants.DURATION_ONEYEAR,
    constants.TEST_EXPIRY
  );
  const xytTokenAddress = await contracts.benchmarkForge.xytTokens.call(
    constants.DURATION_ONEYEAR,
    constants.TEST_EXPIRY
  );
  // console.log(`otTokenAddress = ${otTokenAddress}, xytTokenAddress = ${xytTokenAddress}`);
  contracts.benchmarkOwnershipToken = await BenchmarkOwnershipToken.at(otTokenAddress);
  contracts.benchmarkFutureYieldToken = await BenchmarkFutureYieldToken.at(xytTokenAddress);
  console.log(`\t\tDeployed OT contract at ${otTokenAddress} and XYT contract at ${xytTokenAddress}`);

  return contracts;
}

function getCreate2Address(factory, salt, contractBytecode, constructorTypes, constructorArgs) {
  const bytecode = `${contractBytecode}${web3.eth.abi.encodeParameters(constructorTypes, constructorArgs).slice(2)}`;
  const address = `0x${web3.utils
    .sha3(`0x${['ff', factory, salt, web3.utils.sha3(bytecode)].map((x) => x.replace(/0x/, '')).join('')}`)
    .slice(-40)}`;

  return web3.utils.toChecksumAddress(address);
}

function getCurrentBlock() {
  return new Promise(function (fulfill, reject) {
    web3.eth.getBlockNumber(function (err, result) {
      if (err) reject(err);
      else fulfill(result);
    });
  });
}

function getCurrentBlockTime() {
  return new Promise(function (fulfill, reject) {
    web3.eth.getBlock('latest', false, function (err, result) {
      if (err) reject(err);
      else fulfill(result.timestamp);
    });
  });
}

async function mineBlocks(blocks) {
  for (let i = 0; i < blocks; i++) {
    await time.advanceBlock();
  }
}

async function printBenchmarkAddressDetails(contracts, address) {
  const aaveContracts = await getAaveContracts();
  console.log(`\tBenchmark balances for address ${address}:`);
  console.log(`\t\tOT balance = ${await contracts.benchmarkOwnershipToken.balanceOf.call(address)}`);
  console.log(`\t\tXYT balance = ${await contracts.benchmarkFutureYieldToken.balanceOf.call(address)}`);
  console.log(
    `\t\tlastNormalisedIncome = ${await contracts.benchmarkForge.lastNormalisedIncome.call(
      constants.DURATION_ONEYEAR,
      constants.TEST_EXPIRY,
      address
    )}`
  );
  console.log(`\t\taUSDT balance = ${await aaveContracts.aUSDT.balanceOf.call(address)}`);
}

function mineBlockAtTime(timestamp) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send.bind(web3.currentProvider)(
      {
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [timestamp],
        id: new Date().getTime(),
      },
      (err, res) => {
        if (err) {
          return reject(err);
        }
        resolve(res);
      }
    );
  });
}

async function sendDummyTransactions(accounts, count) {
  if (count == 0) return;
  await web3.eth.sendTransaction({from: accounts[0], to: accounts[0], value: 1});
  await sendDummyTransactions(accounts, count - 1);
}

module.exports = {
  getTokenAmount,
  constants,

  getAaveContracts,
  mintUSDT,
  mintAUSDT,
  printAaveAddressDetails,

  sendDummyTransactions,
  deployContracts,
  getCreate2Address,
  getCurrentBlock,
  getCurrentBlockTime,
  mineBlocks,
  mineBlockAtTime,
  printBenchmarkAddressDetails,
};