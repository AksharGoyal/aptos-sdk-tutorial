import { Account, AccountAddress, Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const APTOS_NETWORK: Network = Network.DEVNET;
const config = new AptosConfig({ network: APTOS_NETWORK });
const aptos = new Aptos(config);

const ALICE_INITIAL_BALANCE = 100_000_000;
const BOB_INITIAL_BALANCE = 0;
const TRANSFER_AMOUNT = 1_000_000;

const balance = async (name: string, accountAddress: AccountAddress, versionToWaitFor?: bigint): Promise<number> => {
  const amount = await aptos.getAccountAPTAmount({
    accountAddress,
    minimumLedgerVersion: versionToWaitFor,
  });
  console.log(`${name}'s balance is: ${amount}`);
  return amount;
};

const quest1 = async () => {
  console.log(
    "This code creates two accounts (Alice and Bob), funds Alice, and transfers between them using transferCoinTransaction.",
  );

  const alice = Account.generate();
  const bob = Account.generate();

  console.log("== Addresses ==\n");
  console.log(`Alice's address is: ${alice.accountAddress}`);
  console.log(`Bob's address is: ${bob.accountAddress}`);

  console.log("\n== Funding Alice's account ==\n");
  await aptos.fundAccount({
    accountAddress: alice.accountAddress,
    amount: ALICE_INITIAL_BALANCE,
  });

  console.log("\n== Initial Balances ==\n");
  const aliceBalance = await balance("Alice", alice.accountAddress);
  const bobBalance = await balance("Bob", bob.accountAddress);

  console.log(`\n== Transfer ${TRANSFER_AMOUNT} from Alice to Bob ==\n`);
  const transaction = await aptos.transferCoinTransaction({
    sender: alice.accountAddress,
    recipient: bob.accountAddress,
    amount: TRANSFER_AMOUNT,
  });
  const pendingTxn = await aptos.signAndSubmitTransaction({ signer: alice, transaction });
  const response = await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
  console.log(`Committed transaction: ${response.hash}`);

  console.log("\n== Balances after transfer ==\n");
  const newAliceBalance = await balance("Alice", alice.accountAddress, BigInt(response.version));
  const newBobBalance = await balance("Bob", bob.accountAddress);

  if (newBobBalance !== TRANSFER_AMOUNT + BOB_INITIAL_BALANCE)
    throw new Error("Bob's balance after transfer is incorrect");

  if (newAliceBalance >= ALICE_INITIAL_BALANCE - TRANSFER_AMOUNT)
    throw new Error("Alice's balance after transfer is incorrect");
};

quest1();
