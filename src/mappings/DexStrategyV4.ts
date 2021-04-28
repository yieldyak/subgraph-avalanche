import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { 
  DexStrategyV4,
  Reinvest as ReinvestEvent
} from '../../generated/DexStrategyV4/DexStrategyV4'
import { User, Farm, Token, Reinvest } from '../../generated/schema'

export function handleReinvest(event: ReinvestEvent): void {
  let id = event.transaction.hash.toHexString() + "-" + event.transactionLogIndex.toString();

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

    let farmContract = DexStrategyV4.bind(event.address);
    farm.name = farmContract.name();
    farm.depositToken = createOrLoadToken(farmContract.depositToken()).id;
    farm.rewardToken = createOrLoadToken(farmContract.rewardToken()).id;
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