import { Address, BigInt, BigDecimal, ethereum } from '@graphprotocol/graph-ts'
import { 
  DexStrategy,
  Deposit as DepositEvent,
  Reinvest as ReinvestEvent,
  Withdraw as WithdrawEvent,
} from '../../generated/DexStrategy/DexStrategy'
import { User, Farm, Token, Reinvest, Deposit, Withdraw, DepositStatus } from '../../generated/schema'

export function handleDeposit(event: DepositEvent): void {}
export function handleWithdraw(event: WithdrawEvent): void {}

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
  reinvest.farm = createOrLoadFarm(event).id;
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

function createOrLoadFarm(event: ReinvestEvent): Farm {
  let id = event.address.toHexString();
  let farm = Farm.load(id);
  if (farm == null) {
    farm = new Farm(id);

    let farmContract = DexStrategy.bind(event.address);
    farm.name = farmContract.name();
    farm.depositToken = createOrLoadToken(farmContract.lpToken()).id;
    farm.rewardToken = createOrLoadToken(farmContract.rewardToken()).id;
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

function createOrLoadUser(event: ReinvestEvent): User {
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