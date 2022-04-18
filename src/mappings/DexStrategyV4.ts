import { Address, BigInt, BigDecimal, ethereum } from '@graphprotocol/graph-ts'
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
  ,DailyActiveAccount } from '../../generated/schema'

  import { DexStrategyV4 } from "../../generated/DexStrategyV4/DexStrategyV4"
  
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

    let token = defineToken(event.transaction.to);

    deposit.asset = token.id;

  // " Amount of token deposited in USD "
  // amountUSD: BigDecimal!

    let defineVault = defineVault(event.transaction.to, event.block.timestamp, event.block.number,);

  " The vault involving this transaction "
  vault: Vault!
    deposit.save();
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

function defineToken(contractAddress: Address): Token {
  let dexStrategyV4Contract = DexStrategyV4.bind(contractAddress)
  let token = Token.load(contractAddress.toHexString())
  if (token == null) {
    token = new Token(contractAddress.toHexString())
    token.name = dexStrategyV4Contract.name();
    token.symbol = dexStrategyV4Contract.symbol();
    token.decimals = dexStrategyV4Contract.decimals();
  }
  token.save()

  return token
}

function defineToken(contractAddress: Address): Token {
  let dexStrategyV4Contract = DexStrategyV4.bind(contractAddress)
  let token = Token.load(contractAddress.toHexString())
  if (token == null) {
    token = new Token(contractAddress.toHexString())
    token.name = dexStrategyV4Contract.name();
    token.symbol = dexStrategyV4Contract.symbol();
    token.decimals = dexStrategyV4Contract.decimals();
  }
  token.save()

  return token
}

function defineVault(contractAddress: Address, timestamp: BigInt, blockNumber: BigInt): Vault {
  let dexStrategyV4Contract = DexStrategyV4.bind(contractAddress)
  let vault = Vault.load(contractAddress.toHexString());
  if (vault == null) {
    vault = new Vault(contractAddress.toHexString());

    let ownerAddress = dexStrategyV4Contract.owner();
    let protocol = defineProtocol(ownerAddress);
    vault.protocol =  protocol.id;


  
  " Tokens that need to be deposited to take a position in protocol. e.g. WETH and USDC to deposit into the WETH-USDC pool "
  inputTokens: [Token!]!

  " Token that is minted to track ownership of position in protocol "
  outputToken: Token

  " Aditional tokens that are given as reward for position in a protocol, usually in liquidity mining programs. e.g. SUSHI in the Onsen program, MATIC for Aave Polygon "
  let rewardTokenAddress = dexStrategyV4Contract.rewardToken();
  let rewardToken = defineRewardToken(rewardTokenAddress);
  rewardTokens: [RewardToken!]



  totalValueLockedUSD: BigDecimal!

  " Total volume in USD "
  totalVolumeUSD: BigDecimal!

  " Amount of input tokens in the vault. The ordering should be the same as the vault's `inputTokens` field. "
  inputTokenBalances: [BigInt!]!

  vault.outputTokenSupply = dexStrategyV4Contract.totalSupply();

  " Price per share of output token in USD "
  outputTokenPriceUSD: BigDecimal!

  " Total amount of reward token emissions in a day, in token's native amount "
  rewardTokenEmissionsAmount: [BigInt!]

  " Total amount of reward token emissions in a day, normalized to USD "
  rewardTokenEmissionsUSD: [BigDecimal!]
  vault.createdTimestamp = timestamp;
  vault.createdBlockNumber = blockNumber;
  vault.name = dexStrategyV4Contract.name();
  vault.symbol = dexStrategyV4Contract.symbol();

  // vault.depositLimit = dexStrategyV4Contract.
  fees: [VaultFee!]!

  }
  vault.save()

  return vault
}




export function handleUpdateAdminFee(event: UpdateAdminFeeEvent): void {
  let farm = createOrLoadFarm(event);
  farm.adminFee = event.params.newValue;
  farm.save();
}

export function handleUpdateDevFee(event: UpdateDevFeeEvent): void {
  let farm = createOrLoadFarm(event);
  farm.devFee = event.params.newValue;
  farm.save();
}

export function handleUpdateReinvestReward(event: UpdateReinvestRewardEvent): void {
  let farm = createOrLoadFarm(event);
  farm.reinvestFee = event.params.newValue;
  farm.save();
}


export function handleWithdraw(event: WithdrawEvent): void {
  let depositStatus = createOrLoadDepositStatus(event);
  if (depositStatus.activeDeposit.lt(event.params.amount)) {
    depositStatus.activeDeposit = BigInt.fromI32(0);
  }
  else {
    depositStatus.activeDeposit = depositStatus.activeDeposit.minus(event.params.amount);
  }
  depositStatus.withdrawCount = depositStatus.withdrawCount.plus(BigInt.fromI32(1));
  depositStatus.totalWithdraws = depositStatus.totalWithdraws.plus(event.params.amount);
  depositStatus.save()

  let farm = createOrLoadFarm(event);
  farm.depositTokenBalance = farm.depositTokenBalance.minus(event.params.amount);
  farm.save();

  let id = event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let withdraw = new Withdraw(id);
  withdraw.by = createOrLoadUser(event).id;
  withdraw.farm = farm.id;
  withdraw.amount = event.params.amount;
  withdraw.blockTimestamp = event.block.timestamp;
  withdraw.blockNumber = event.block.number;
  withdraw.transactionHash = event.transaction.hash;
  withdraw.save();
}

export function handleReinvest(event: ReinvestEvent): void {
  let id = event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();

  let farm = createOrLoadFarm(event);
  farm.reinvestCount = farm.reinvestCount.plus(BigInt.fromI32(1));
  farm.depositTokenBalance = event.params.newTotalDeposits;
  farm.save();

  let user = createOrLoadUser(event);
  user.reinvestCount = user.reinvestCount.plus(BigInt.fromI32(1));
  user.save();

  let reinvest = new Reinvest(id);
  reinvest.by = user.id;
  reinvest.farm = farm.id;
  reinvest.reinvestCount = farm.reinvestCount;
  reinvest.blockTimestamp = event.block.timestamp;
  reinvest.blockNumber = event.block.number;
  reinvest.totalDeposits = event.params.newTotalDeposits;
  reinvest.totalSupply = event.params.newTotalSupply;
  reinvest.transactionHash = event.transaction.hash;
  if (reinvest.totalDeposits.equals(BigInt.fromI32(0)) || reinvest.totalSupply.equals(BigInt.fromI32(0))) {
    reinvest.ratio = BigDecimal.fromString("1");
  }
  else {
    reinvest.ratio = reinvest.totalDeposits.divDecimal(BigDecimal.fromString(reinvest.totalSupply.toString()));
  }
  reinvest.save();
}

function createOrLoadFarm(event: ethereum.Event): Farm {
  let id = event.address.toHexString();
  let farm = Farm.load(id);
  if (farm == null) {
    farm = new Farm(id);

    let farmContract = DexStrategyV4.bind(event.address);
    farm.name = farmContract.name();
    farm.depositToken = createOrLoadToken(farmContract.depositToken()).id;
    farm.rewardToken = createOrLoadToken(farmContract.rewardToken()).id;
    farm.adminFee = farmContract.ADMIN_FEE_BIPS();

    let devFeeResult = farmContract.try_DEV_FEE_BIPS();
    farm.devFee = devFeeResult.reverted ? BigInt.fromI32(0) : devFeeResult.value;
    
    farm.reinvestFee = farmContract.REINVEST_REWARD_BIPS();
    farm.reinvestCount = BigInt.fromI32(0);
    farm.depositTokenBalance = BigInt.fromI32(0);
  }
  farm.save();
  return farm!;
}

function createOrLoadToken(id: Address): Token {
  let token = Token.load(id.toHexString());
  if (token == null) {
    token = new Token(id.toHexString());
  }
  token.save();
  return token!;
}

function createOrLoadUser(event: ethereum.Event): User {
  let id = event.transaction.from.toHexString();
  let user = User.load(id);
  if (user == null) {
    user = new User(id);
    user.reinvestCount = BigInt.fromI32(0);
  }
  user.save();
  return user!;
}

function createOrLoadDepositStatus(event: ethereum.Event): DepositStatus {
  let id = event.transaction.from.toHexString() + "-" + event.address.toHexString();
  let depositStatus = DepositStatus.load(id);
  if (depositStatus == null) {
    depositStatus = new DepositStatus(id);
    depositStatus.farm = createOrLoadFarm(event).id;
    depositStatus.user = createOrLoadUser(event).id;
    depositStatus.activeDeposit = BigInt.fromI32(0);
    depositStatus.totalDeposits = BigInt.fromI32(0);
    depositStatus.totalWithdraws = BigInt.fromI32(0);
    depositStatus.depositCount = BigInt.fromI32(0);
    depositStatus.withdrawCount = BigInt.fromI32(0);
  }
  depositStatus.save();
  return depositStatus!;
}