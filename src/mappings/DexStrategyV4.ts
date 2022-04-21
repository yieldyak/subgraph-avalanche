import { Address, BigInt, BigDecimal, ethereum, bigInt, bigDecimal } from '@graphprotocol/graph-ts'
import { 
  Deposit as DepositEvent,
  Recovered as RecoveredEvent,
  Reinvest as ReinvestEvent,
  Withdraw as WithdrawEvent,
  UpdateAdminFee as UpdateAdminFeeEvent,
  UpdateDevFee as UpdateDevFeeEvent,
  UpdateReinvestReward as UpdateReinvestRewardEvent
} from '../../generated/DexStrategyV4/DexStrategyV4'
import { Token
  ,RewardToken
  ,YieldAggregator
  ,UsageMetricsDailySnapshot
  ,FinancialsDailySnapshot
  ,VaultFee
  ,Vault
  ,VaultDailySnapshot
  ,Deposit
  ,Withdraw
  ,Account
  ,DailyActiveAccount} from '../../generated/schema'

  import { DexStrategyV4 } from "../../generated/DexStrategyV4/DexStrategyV4"
  import { Token as TokenContract } from "../../generated/x0aBD79f5144a70bFA3E3Aeed183f9e1A4d80A34F/Token"
  import { YakRouter, YakRouter__findBestPathResultValue0Struct } from "../../generated/x0aBD79f5144a70bFA3E3Aeed183f9e1A4d80A34F/YakRouter"
  
  import { convertBINumToDesiredDecimals } from "./utils/converters"

export function handleDeposit(event: DepositEvent): void {

  let transactionHash = event.transaction.hash;
  let logIndex = event.logIndex;
  let deposit = Deposit.load(transactionHash.toHexString().concat("-").concat(logIndex.toHexString()))
  if (deposit == null) {
    deposit = new Deposit(transactionHash.toHexString().concat("-").concat(logIndex.toHexString()))
  }
  deposit.hash = event.transaction.hash.toHexString();
  deposit.logIndex = event.logIndex;
  deposit.to = event.transaction.to.toHexString();
  deposit.from = event.transaction.from.toHexString();
  deposit.blockNumber = event.block.number;
  deposit.timestamp = event.block.timestamp;
  deposit.amount = event.params.amount;

  let dexStrategyV4Contract = DexStrategyV4.bind(event.transaction.to)
  let ownerAddress = dexStrategyV4Contract.owner();
  let protocol = defineProtocol(ownerAddress);
  deposit.protocol =  protocol.id;

  let inputTokenAddress = dexStrategyV4Contract.depositToken();
  let inputToken = defineInputToken(inputTokenAddress);

  deposit.asset = inputToken.id;
  deposit.amountUSD = priceInUSD(dexStrategyV4Contract.depositToken(), event.transaction.value);

  let vault = defineVault(event.transaction.to, event.block.timestamp, event.block.number);
  let depositTokenPrice: BigDecimal = priceInUSD(dexStrategyV4Contract.depositToken(),bigInt.fromString("1000000000000000000"));
  vault.totalValueLockedUSD = depositTokenPrice.times(convertBINumToDesiredDecimals(dexStrategyV4Contract.totalSupply(), 18));
  vault.totalVolumeUSD = vault.totalVolumeUSD.plus(depositTokenPrice.times(convertBINumToDesiredDecimals(event.transaction.value, 18)));
  vault.outputTokenSupply = dexStrategyV4Contract.totalSupply();
  let numberOfInputTokens = vault.inputTokens.length
  for (let index = 0; index < numberOfInputTokens; index++) {
    let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
    vault.inputTokenBalances[tokenIndex] = dexStrategyV4Contract.totalSupply();
  }
  
  deposit.vault = vault.id;
  deposit.save();

  let isAccountNew = defineAccount(event.transaction.from);
  let isDailyAccountNew = defineDailyActiveAccount(event.transaction.from, event.block.timestamp);
  defineUsageMetricsDailySnapshotEntity(event.block.timestamp,event.block.number,protocol, isAccountNew,isDailyAccountNew);
  let vaultDailySnapshotEntity = defineVaultDailySnapshot(event.block.timestamp,event.block.number,event.transaction.to)
  vaultDailySnapshotEntity.totalValueLockedUSD = vaultDailySnapshotEntity.totalValueLockedUSD.plus(convertBINumToDesiredDecimals(event.transaction.value, 18))
  vaultDailySnapshotEntity.totalVolumeUSD = vaultDailySnapshotEntity.totalVolumeUSD.plus(convertBINumToDesiredDecimals(event.transaction.value, 18))
  vaultDailySnapshotEntity.outputTokenSupply = dexStrategyV4Contract.totalSupply()
  vault.outputTokenPriceUSD = calculateOutputTokenPriceInUSD(event.transaction.to)
  
  let financialsDailySnapshotEntity = defineFinancialsDailySnapshotEntity(event.block.timestamp,event.block.number,event.transaction.to)
  financialsDailySnapshotEntity.totalValueLockedUSD = financialsDailySnapshotEntity.totalValueLockedUSD.plus(convertBINumToDesiredDecimals(event.transaction.value, 18))
  financialsDailySnapshotEntity.totalVolumeUSD = financialsDailySnapshotEntity.totalVolumeUSD.plus(convertBINumToDesiredDecimals(event.transaction.value, 18))

  vault.save();
  vaultDailySnapshotEntity.save();
  financialsDailySnapshotEntity.save();
}
  
export function handleWithdraw(event: WithdrawEvent): void {

  let transactionHash = event.transaction.hash;
  let logIndex = event.logIndex;
  let withdraw = Withdraw.load(transactionHash.toHexString().concat("-").concat(logIndex.toHexString()))
  if (withdraw == null) {
    withdraw = new Withdraw(transactionHash.toHexString().concat("-").concat(logIndex.toHexString()))
  }
  withdraw.hash = event.transaction.hash.toHexString();
  withdraw.logIndex = event.logIndex;
  withdraw.to = event.transaction.to.toHexString();
  withdraw.from = event.transaction.from.toHexString();
  withdraw.blockNumber = event.block.number;
  withdraw.timestamp = event.block.timestamp;
  withdraw.amount = event.params.amount;

  let dexStrategyV4Contract = DexStrategyV4.bind(event.transaction.to)
  let ownerAddress = dexStrategyV4Contract.owner();
  let protocol = defineProtocol(ownerAddress);
  withdraw.protocol =  protocol.id;
  let inputTokenAddress = dexStrategyV4Contract.depositToken();
  let inputToken = defineInputToken(inputTokenAddress);

  withdraw.asset = inputToken.id;
  withdraw.amountUSD = priceInUSD(dexStrategyV4Contract.depositToken(), event.transaction.value);

  let vault = defineVault(event.transaction.to, event.block.timestamp, event.block.number);
  let depositTokenPrice: BigDecimal = priceInUSD(dexStrategyV4Contract.depositToken(),bigInt.fromString("1000000000000000000"));
  vault.totalValueLockedUSD = depositTokenPrice.times(convertBINumToDesiredDecimals(dexStrategyV4Contract.totalSupply(), 18));
  vault.totalVolumeUSD = vault.totalVolumeUSD.plus(depositTokenPrice.times(convertBINumToDesiredDecimals(event.transaction.value, 18)));
  vault.outputTokenSupply = dexStrategyV4Contract.totalSupply();
  let numberOfInputTokens = vault.inputTokens.length
  for (let index = 0; index < numberOfInputTokens; index++) {
    let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
    vault.inputTokenBalances[tokenIndex] = dexStrategyV4Contract.totalSupply();
  }
  withdraw.vault = vault.id;
  withdraw.save();

  let isAccountNew = defineAccount(event.transaction.from);
  let isDailyAccountNew = defineDailyActiveAccount(event.transaction.from, event.block.timestamp);
  defineUsageMetricsDailySnapshotEntity(event.block.timestamp,event.block.number,protocol, isAccountNew,isDailyAccountNew);

  let vaultDailySnapshotEntity = defineVaultDailySnapshot(event.block.timestamp,event.block.number,event.transaction.to)
  vaultDailySnapshotEntity.totalValueLockedUSD = vaultDailySnapshotEntity.totalValueLockedUSD.minus(convertBINumToDesiredDecimals(event.transaction.value, 18))
  vaultDailySnapshotEntity.totalVolumeUSD = vaultDailySnapshotEntity.totalVolumeUSD.plus(convertBINumToDesiredDecimals(event.transaction.value, 18))
  vaultDailySnapshotEntity.outputTokenSupply = dexStrategyV4Contract.totalSupply()
  vault.outputTokenPriceUSD = calculateOutputTokenPriceInUSD(event.transaction.to)
  
  let financialsDailySnapshotEntity = defineFinancialsDailySnapshotEntity(event.block.timestamp,event.block.number,event.transaction.to)
  financialsDailySnapshotEntity.totalValueLockedUSD = financialsDailySnapshotEntity.totalValueLockedUSD.minus(convertBINumToDesiredDecimals(event.transaction.value, 18))
  financialsDailySnapshotEntity.totalVolumeUSD = financialsDailySnapshotEntity.totalVolumeUSD.plus(convertBINumToDesiredDecimals(event.transaction.value, 18))

  vault.save();
  vaultDailySnapshotEntity.save();
  financialsDailySnapshotEntity.save();
}


export function handleReinvest(event: ReinvestEvent): void {

  let dexStrategyV4Contract = DexStrategyV4.bind(event.transaction.to)
  let depositTokenPrice: BigDecimal = priceInUSD(dexStrategyV4Contract.depositToken(),bigInt.fromString("1000000000000000000"));

  let vault = defineVault(event.transaction.to, event.block.timestamp, event.block.number);
  let beforeReinvestSupply = vault.outputTokenSupply;
  let distributedReward = event.params.newTotalSupply.minus(beforeReinvestSupply);
  let allFees = (dexStrategyV4Contract.DEV_FEE_BIPS().plus(dexStrategyV4Contract.ADMIN_FEE_BIPS().plus(dexStrategyV4Contract.REINVEST_REWARD_BIPS()))).toBigDecimal().div(bigDecimal.fromString("1000"));
  let allDistributedReward = distributedReward.toBigDecimal().div(allFees);
  let protocolReward = allDistributedReward.times(dexStrategyV4Contract.ADMIN_FEE_BIPS().toBigDecimal()).div(bigDecimal.fromString("1000"));
  let protocolGrossReward = allDistributedReward.times(allFees);
  let distributedRewardInUSD = depositTokenPrice.times(convertBINumToDesiredDecimals(distributedReward, 18));

  vault.totalValueLockedUSD = depositTokenPrice.times(convertBINumToDesiredDecimals(event.params.newTotalSupply, 18));
  vault.totalVolumeUSD = vault.totalVolumeUSD.plus(depositTokenPrice.times(convertBINumToDesiredDecimals(distributedReward, 18)));
  vault.outputTokenSupply = dexStrategyV4Contract.totalSupply();
  let numberOfInputTokens = vault.inputTokens.length
  for (let index = 0; index < numberOfInputTokens; index++) {
    let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
    vault.inputTokenBalances[tokenIndex] = dexStrategyV4Contract.totalSupply();
  }
  let numberOfRewardTokens = vault.rewardTokens.length
  for (let index = 0; index < numberOfRewardTokens; index++) {
    let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
    vault.rewardTokenEmissionsAmount[tokenIndex] = vault.rewardTokenEmissionsAmount[tokenIndex].plus(distributedReward)
    vault.rewardTokenEmissionsUSD[tokenIndex] =vault.rewardTokenEmissionsUSD[tokenIndex].plus(distributedRewardInUSD)
  }

  let vaultDailySnapshotEntity = defineVaultDailySnapshot(event.block.timestamp,event.block.number,event.transaction.to)
  vaultDailySnapshotEntity.totalValueLockedUSD = vaultDailySnapshotEntity.totalValueLockedUSD.plus(convertBINumToDesiredDecimals(distributedReward, 18))
  vaultDailySnapshotEntity.totalVolumeUSD = vaultDailySnapshotEntity.totalVolumeUSD.plus(convertBINumToDesiredDecimals(distributedReward, 18))
  vaultDailySnapshotEntity.outputTokenSupply = event.params.newTotalSupply
  vault.outputTokenPriceUSD = calculateOutputTokenPriceInUSD(event.transaction.to)

  for (let index = 0; index < numberOfInputTokens; index++) {
    let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
    vaultDailySnapshotEntity.inputTokenBalances[tokenIndex] = dexStrategyV4Contract.totalSupply();
  }
  for (let index = 0; index < numberOfRewardTokens; index++) {
    let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
    vaultDailySnapshotEntity.rewardTokenEmissionsAmount[tokenIndex] = vaultDailySnapshotEntity.rewardTokenEmissionsAmount[tokenIndex].plus(distributedReward)
    vaultDailySnapshotEntity.rewardTokenEmissionsUSD[tokenIndex] =vaultDailySnapshotEntity.rewardTokenEmissionsUSD[tokenIndex].plus(distributedRewardInUSD)
  }
  let financialsDailySnapshotEntity = defineFinancialsDailySnapshotEntity(event.block.timestamp,event.block.number,event.transaction.to)
  financialsDailySnapshotEntity.totalValueLockedUSD = financialsDailySnapshotEntity.totalValueLockedUSD.plus(convertBINumToDesiredDecimals(distributedReward, 18))
  financialsDailySnapshotEntity.totalVolumeUSD = financialsDailySnapshotEntity.totalVolumeUSD.plus(convertBINumToDesiredDecimals(distributedReward, 18))
  financialsDailySnapshotEntity.supplySideRevenueUSD = financialsDailySnapshotEntity.supplySideRevenueUSD.plus(distributedRewardInUSD)
  financialsDailySnapshotEntity.protocolSideRevenueUSD = financialsDailySnapshotEntity.protocolSideRevenueUSD.plus(protocolReward)
  financialsDailySnapshotEntity.totalRevenueUSD = financialsDailySnapshotEntity.totalRevenueUSD.plus(protocolGrossReward)

  vault.save();
  vaultDailySnapshotEntity.save();
  financialsDailySnapshotEntity.save();
}


function defineProtocol(ownerAddress: Address): YieldAggregator {
  let protocol = YieldAggregator.load(ownerAddress.toHexString())
  if (protocol == null) {
    protocol = new YieldAggregator(ownerAddress.toHexString())
  }

  protocol.name = "Yield Yak"
  protocol.slug = "yak"
  protocol.schemaVersion = "1.0.0"
  protocol.subgraphVersion = "1.0.0"
  protocol.methodologyVersion = "1.0.0"
  protocol.network = "AVALANCHE"
  protocol.type = "YIELD"

  protocol.save()

  return protocol
}



function defineInputToken(tokenAddress: Address): Token {
  let avaxAddress: Address = Address.fromString("0x0000000000000000000000000000000000000000");
  if (tokenAddress == avaxAddress) {
    tokenAddress = Address.fromString("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7");
  }
  let tokenContract = TokenContract.bind(tokenAddress);
  let token = Token.load(tokenAddress.toHexString())
  if (token == null) {
    token = new Token(tokenAddress.toHexString())
    token.name = tokenContract.name();
    token.symbol = tokenContract.symbol();
    token.decimals = tokenContract.decimals();
  }
  token.save()

  return token
}

function defineOutputToken(tokenAddress: Address): Token {

  let tokenContract = DexStrategyV4.bind(tokenAddress);
  let token = Token.load(tokenAddress.toHexString())
  if (token == null) {
    token = new Token(tokenAddress.toHexString())
    token.name = tokenContract.name();
    token.symbol = tokenContract.symbol();
    token.decimals = tokenContract.decimals();
  }
  token.save()

  return token
}



function defineRewardToken(rewardTokenAddress: Address): RewardToken {
  let rewardTokenContract = TokenContract.bind(rewardTokenAddress);
  let rewardToken = RewardToken.load(rewardTokenAddress.toHexString())
  if (rewardToken == null) {
    rewardToken = new RewardToken(rewardTokenAddress.toHexString())
    rewardToken.name = rewardTokenContract.name();
    rewardToken.symbol = rewardTokenContract.symbol();
    rewardToken.decimals = rewardTokenContract.decimals();
    rewardToken.type = "DEPOSIT";
  }
  rewardToken.save()

  return rewardToken
}

function defineVault(contractAddress: Address, timestamp: BigInt, blockNumber: BigInt): Vault {
  let dexStrategyV4Contract = DexStrategyV4.bind(contractAddress)
  let vault = Vault.load(contractAddress.toHexString());
  if (vault == null) {
    vault = new Vault(contractAddress.toHexString());

    let ownerAddress = dexStrategyV4Contract.owner();
    let protocol = defineProtocol(ownerAddress);
    vault.protocol =  protocol.id;


    let inputTokenAddress = dexStrategyV4Contract.depositToken();
    let inputToken = defineInputToken(inputTokenAddress);
    vault.inputTokens.push(inputToken.id)
  
    let outputToken = defineOutputToken(contractAddress)
    vault.outputToken = outputToken.id;



    let rewardTokenAddress = dexStrategyV4Contract.rewardToken();
    let rewardToken = defineRewardToken(rewardTokenAddress);
    vault.rewardTokens.push(rewardToken.id)
    vault.inputTokenBalances.push(bigInt.fromString("0"));

    vault.createdTimestamp = timestamp;
    vault.createdBlockNumber = blockNumber;
    vault.name = dexStrategyV4Contract.name();
    vault.symbol = dexStrategyV4Contract.symbol();
  

  

  let adminFee = new VaultFee(contractAddress.toHexString().concat("-adminFee"));
  adminFee.feePercentage = convertBINumToDesiredDecimals(dexStrategyV4Contract.ADMIN_FEE_BIPS(),4) ;
  adminFee.feeType = "PERFORMANCE_FEE"
  adminFee.save();
  
  let developerFee = new VaultFee(contractAddress.toHexString().concat("-developerFee"));
  developerFee.feePercentage = convertBINumToDesiredDecimals(dexStrategyV4Contract.DEV_FEE_BIPS(),4) ;
  developerFee.feeType = "PERFORMANCE_FEE"
  developerFee.save();
  
  let reinvestorFee = new VaultFee(contractAddress.toHexString().concat("-reinvestorFee"));
  reinvestorFee.feePercentage = convertBINumToDesiredDecimals(dexStrategyV4Contract.REINVEST_REWARD_BIPS(),4) ;
  reinvestorFee.feeType = "PERFORMANCE_FEE"
  reinvestorFee.save();

  vault.fees.push(adminFee.id);
  vault.fees.push(developerFee.id);
  vault.fees.push(reinvestorFee.id);

  }
  

  " Price per share of output token in USD "
  let depositTokenPrice: BigDecimal = priceInUSD(dexStrategyV4Contract.depositToken(),bigInt.fromString("1000000000000000000"));
  let getSharesForDepositToken: BigInt = dexStrategyV4Contract.getSharesForDepositTokens(bigInt.fromString("1000000000000000000"));
  let getSharesForDepositTokenInDecimal: BigDecimal = convertBINumToDesiredDecimals(getSharesForDepositToken, 18);
  vault.outputTokenPriceUSD = depositTokenPrice.div(getSharesForDepositTokenInDecimal);


  vault.save()

  return vault
}

function priceInUSD(tokenAddress: Address, amount: BigInt): BigDecimal {
  let usdcAddress: Address = Address.fromString("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E");
  let avaxAddress: Address = Address.fromString("0x0000000000000000000000000000000000000000");
  if (tokenAddress == avaxAddress) {
    tokenAddress = Address.fromString("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7");
  }
  let yakRouterAddress: Address = Address.fromString("0xC4729E56b831d74bBc18797e0e17A295fA77488c");
  let yakRouter = YakRouter.bind(yakRouterAddress);
  let tokenPriceInUSDStructure: YakRouter__findBestPathResultValue0Struct = yakRouter.findBestPath(amount,tokenAddress,usdcAddress,bigInt.fromString("2"));
  let tokenPriceInUSDWithDecimal: BigDecimal = convertBINumToDesiredDecimals(tokenPriceInUSDStructure.amounts[0], 18);
  return tokenPriceInUSDWithDecimal;
}

function defineAccount(accountAddress: Address): number {
  let checker = 0;
  let account = Account.load(accountAddress.toHexString());
  if (account == null) {
    account = new Account(accountAddress.toHexString());
    checker = 1;
  }
  return checker;
}

function defineDailyActiveAccount(accountAddress: Address, timestamp: BigInt): number {
  let checker = 0;
  let daysFromStart = timestamp.toI32() / 24 / 60 / 60
  let account = DailyActiveAccount.load(accountAddress.toHexString().concat("-").concat(daysFromStart.toString()));
  if (account == null) {
    account = new DailyActiveAccount(accountAddress.toHexString().concat("-").concat(daysFromStart.toString()));
    checker = 1;
  }
  return checker;
}

function defineUsageMetricsDailySnapshotEntity(
  timestamp: BigInt,
  blockNumber: BigInt,
  protocol: YieldAggregator,
  isAccountUniqe: number,
  isDailyAccountUniqe: number,
): UsageMetricsDailySnapshot {
  let daysFromStart = timestamp.toI32() / 24 / 60 / 60
  let usageMetricsDailySnapshotEntity = UsageMetricsDailySnapshot.load(daysFromStart.toString())
  if (usageMetricsDailySnapshotEntity == null) {
    usageMetricsDailySnapshotEntity = new UsageMetricsDailySnapshot(daysFromStart.toString())
    usageMetricsDailySnapshotEntity.timestamp = timestamp
    usageMetricsDailySnapshotEntity.blockNumber = blockNumber
    usageMetricsDailySnapshotEntity.protocol = protocol.id
  }
  usageMetricsDailySnapshotEntity.dailyTransactionCount = usageMetricsDailySnapshotEntity.dailyTransactionCount + 1
  usageMetricsDailySnapshotEntity.activeUsers = usageMetricsDailySnapshotEntity.activeUsers + isAccountUniqe
  usageMetricsDailySnapshotEntity.totalUniqueUsers = usageMetricsDailySnapshotEntity.totalUniqueUsers + isDailyAccountUniqe
  usageMetricsDailySnapshotEntity.save()
  return usageMetricsDailySnapshotEntity
}


function defineFinancialsDailySnapshotEntity(
  timestamp: BigInt,
  blockNumber: BigInt,
  contractAddress: Address,
): FinancialsDailySnapshot {
  let dexStrategyV4Contract = DexStrategyV4.bind(contractAddress)
  let ownerAddress = dexStrategyV4Contract.owner();
  let protocol = defineProtocol(ownerAddress)
  let daysFromStart = timestamp.toI32() / 24 / 60 / 60
  let financialsDailySnapshotEntity = FinancialsDailySnapshot.load(daysFromStart.toString())
  if (financialsDailySnapshotEntity == null) {
    financialsDailySnapshotEntity = new FinancialsDailySnapshot(daysFromStart.toString())
    financialsDailySnapshotEntity.timestamp = timestamp
    financialsDailySnapshotEntity.blockNumber = blockNumber
    financialsDailySnapshotEntity.protocol = protocol.id
    financialsDailySnapshotEntity.totalValueLockedUSD = bigDecimal.fromString("0")
    financialsDailySnapshotEntity.totalVolumeUSD = bigDecimal.fromString("0")
  }

  financialsDailySnapshotEntity.save()
  return financialsDailySnapshotEntity
}

function defineVaultDailySnapshot(
  timestamp: BigInt,
  blockNumber: BigInt,
  contractAddress: Address,
): VaultDailySnapshot {
  let dexStrategyV4Contract = DexStrategyV4.bind(contractAddress)
  let ownerAddress = dexStrategyV4Contract.owner();
  let protocol = defineProtocol(ownerAddress)
  let daysFromStart = timestamp.toI32() / 24 / 60 / 60
  let vaultDailySnapshotEntity = VaultDailySnapshot.load(contractAddress.toHexString().concat("-").concat(daysFromStart.toString()))
  if (vaultDailySnapshotEntity == null) {
    vaultDailySnapshotEntity = new VaultDailySnapshot(contractAddress.toHexString().concat("-").concat(daysFromStart.toString()))
    vaultDailySnapshotEntity.timestamp = timestamp
    vaultDailySnapshotEntity.blockNumber = blockNumber
    vaultDailySnapshotEntity.protocol = protocol.id
    let vault = defineVault(contractAddress,timestamp,blockNumber);
    vaultDailySnapshotEntity.vault = vault.id;

    let numberOfInputTokens = vault.inputTokens.length
    for (let index = 0; index < numberOfInputTokens; index++) {
      let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
      vaultDailySnapshotEntity.inputTokenBalances[tokenIndex] = dexStrategyV4Contract.totalSupply();
    }
    let numberOfRewardTokens = vault.rewardTokens.length
    for (let index = 0; index < numberOfRewardTokens; index++) {
      let tokenIndex = vault.inputTokens.indexOf(vault.inputTokens[index])
      vaultDailySnapshotEntity.rewardTokenEmissionsAmount[tokenIndex] = bigInt.fromString("0");
      vaultDailySnapshotEntity.rewardTokenEmissionsUSD[tokenIndex] = bigDecimal.fromString("0");
    }
  }
  vaultDailySnapshotEntity.save()
  return vaultDailySnapshotEntity
}

function calculateOutputTokenPriceInUSD(contractAddress: Address): BigDecimal {
  let dexStrategyV4Contract = DexStrategyV4.bind(contractAddress)
  let depositTokenPrice: BigDecimal = priceInUSD(dexStrategyV4Contract.depositToken(),bigInt.fromString("1000000000000000000"));
  let getSharesForDepositToken: BigInt = dexStrategyV4Contract.getSharesForDepositTokens(bigInt.fromString("1000000000000000000"));
  let getSharesForDepositTokenInDecimal: BigDecimal = convertBINumToDesiredDecimals(getSharesForDepositToken, 18);
  let OutputTokenPriceInUSD = depositTokenPrice.div(getSharesForDepositTokenInDecimal);
  return OutputTokenPriceInUSD
}

export function handleUpdateAdminFee(event: UpdateAdminFeeEvent): void {
  let updatedFee = VaultFee.load(event.transaction.to.toHexString().concat("-adminFee"))
  if (updatedFee == null) {
    updatedFee = new VaultFee(event.transaction.to.toHexString().concat("-adminFee"));
  }
  updatedFee.feePercentage = convertBINumToDesiredDecimals(event.params.newValue,4) ;
  updatedFee.save();
}
export function handleUpdateDevFee(event: UpdateDevFeeEvent): void {
  let updatedFee = VaultFee.load(event.transaction.to.toHexString().concat("-adminFee"))
  if (updatedFee == null) {
    updatedFee = new VaultFee(event.transaction.to.toHexString().concat("-adminFee"));
  }
  updatedFee.feePercentage = convertBINumToDesiredDecimals(event.params.newValue,4) ;
  updatedFee.save();
}
export function handleReinvestReward(event: UpdateReinvestRewardEvent): void {
  let updatedFee = VaultFee.load(event.transaction.to.toHexString().concat("-adminFee"))
  if (updatedFee == null) {
    updatedFee = new VaultFee(event.transaction.to.toHexString().concat("-adminFee"));
  }
  updatedFee.feePercentage = convertBINumToDesiredDecimals(event.params.newValue,4) ;
  updatedFee.save();
}

