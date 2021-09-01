import { Address, BigInt, BigDecimal, ethereum } from '@graphprotocol/graph-ts'
import { 
  DexStrategyV4,
  Deposit as DepositEvent,
  Reinvest as ReinvestEvent,
  Withdraw as WithdrawEvent,
  UpdateAdminFee as UpdateAdminFeeEvent,
  UpdateDevFee as UpdateDevFeeEvent,
  UpdateReinvestReward as UpdateReinvestRewardEvent
} from '../../generated/DexStrategyV4/DexStrategyV4'
import { User, Farm, Token, Reinvest, Deposit, Withdraw, DepositStatus } from '../../generated/schema'

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

export function handleDeposit(event: DepositEvent): void {
  let depositStatus = createOrLoadDepositStatus(event);
  depositStatus.activeDeposit = depositStatus.activeDeposit.plus(event.params.amount);
  depositStatus.depositCount = depositStatus.depositCount.plus(BigInt.fromI32(1));
  depositStatus.totalDeposits = depositStatus.totalDeposits.plus(event.params.amount);
  depositStatus.save();

  let farm = createOrLoadFarm(event);
  farm.depositTokenBalance = farm.depositTokenBalance.plus(event.params.amount);
  farm.save();

  let id = event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();
  let deposit = new Deposit(id);
  deposit.by = createOrLoadUser(event).id;
  deposit.farm = farm.id;
  deposit.amount = event.params.amount;
  deposit.blockTimestamp = event.block.timestamp;
  deposit.blockNumber = event.block.number;
  deposit.transactionHash = event.transaction.hash;
  deposit.save();
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