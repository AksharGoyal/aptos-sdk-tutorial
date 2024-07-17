import {
  Account,
  AccountAddress,
  AnyNumber,
  Aptos,
  AptosConfig,
  InputViewFunctionData,
  Network
} from "@aptos-labs/ts-sdk";
import { compilePackage, getPackageBytesToPublish } from "./utils";

const APTOS_NETWORK: Network = Network.TESTNET;
const config = new AptosConfig({ network: APTOS_NETWORK });
const aptos = new Aptos(config);
async function transferCoin(
  admin: Account,
  fromAddress: AccountAddress,
  toAddress: AccountAddress,
  amount: AnyNumber,
): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::transfer`,
      functionArguments: [fromAddress, toAddress, amount],
    },
  });

  const senderAuthenticator = await aptos.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await aptos.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}
async function mintCoin(admin: Account, receiver: Account, amount: AnyNumber): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::mint`,
      functionArguments: [receiver.accountAddress, amount],
    },
  });

  const senderAuthenticator = await aptos.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await aptos.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}
async function burnCoin(admin: Account, fromAddress: AccountAddress, amount: AnyNumber): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::burn`,
      functionArguments: [fromAddress, amount],
    },
  });

  const senderAuthenticator = await aptos.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await aptos.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}
async function freeze(admin: Account, targetAddress: AccountAddress): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::freeze_account`,
      functionArguments: [targetAddress],
    },
  });

  const senderAuthenticator = await aptos.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await aptos.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}

async function unfreeze(admin: Account, targetAddress: AccountAddress): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::unfreeze_account`,
      functionArguments: [targetAddress],
    },
  });

  const senderAuthenticator = await aptos.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await aptos.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}
const getStackBalance = async (owner: Account, assetType: string): Promise<number> => {
  const data = await aptos.getCurrentFungibleAssetBalances({
    options: {
      where: {
        owner_address: { _eq: owner.accountAddress.toStringLong() },
        asset_type: { _eq: assetType },
      },
    },
  });

  return data[0]?.amount ?? 0;
};

async function getMetadata(admin: Account): Promise<string> {
  const payload: InputViewFunctionData = {
    function: `${admin.accountAddress}::fa_coin::get_metadata`,
    functionArguments: [],
  };
  const res = (await aptos.view<[{ inner: string }]>({ payload }))[0];
  return res.inner;
}
async function main() {
  const alice = Account.generate();
  const bob = Account.generate();
  const charlie = Account.generate();

  console.log("\n=== Addresses ===");
  console.log(`Alice: ${alice.accountAddress.toString()}`);
  console.log(`Bob: ${bob.accountAddress.toString()}`);
  console.log(`Charlie: ${charlie.accountAddress.toString()}`);

  await aptos.fundAccount({ accountAddress: alice.accountAddress, amount: 100_000_000 });
  await aptos.fundAccount({ accountAddress: bob.accountAddress, amount: 100_000_000 });
  console.log("\n=== Compiling StackCoin package locally ===");
  compilePackage("stackcoin", "stackcoin/stackcoin.json", [{ name: "StackCoin", address: alice.accountAddress }]);

  const { metadataBytes, byteCode } = getPackageBytesToPublish("stackcoin/stackcoin.json");

  console.log("\n===Publishing StackCoin package===");
  const transaction = await aptos.publishPackageTransaction({
    account: alice.accountAddress,
    metadataBytes,
    moduleBytecode: byteCode,
  });
  const response = await aptos.signAndSubmitTransaction({
    signer: alice,
    transaction,
  });
  console.log(`Transaction hash: ${response.hash}`);
  await aptos.waitForTransaction({
    transactionHash: response.hash,
  });

  const metadataAddress = await getMetadata(alice);
  console.log("metadata address:", metadataAddress);
  console.log("All the balances here refer to the balance in primary fungible stores of each account.");
  console.log(`Alice's initial StackCoin balance: ${await getStackBalance(alice, metadataAddress)}.`);
  console.log(`Bob's initial StackCoin balance: ${await getStackBalance(bob, metadataAddress)}.`);
  console.log(`Charlie's initial balance: ${await getStackBalance(charlie, metadataAddress)}.`);

  console.log("Alice mints Charlie 100 coins.");
  const mintCoinTransactionHash = await mintCoin(alice, charlie, 100);

  await aptos.waitForTransaction({ transactionHash: mintCoinTransactionHash });
  console.log(
    `Charlie's new StackCoin primary fungible store balance: ${await getStackBalance(charlie, metadataAddress)}.`,
  );
  console.log("Alice freezes Bob's account.");
  const freezeTransactionHash = await freeze(alice, bob.accountAddress);
  await aptos.waitForTransaction({ transactionHash: freezeTransactionHash });

  console.log(
    "Alice as the admin forcefully transfers the newly minted coins of Charlie to Bob ignoring that Bob's account is frozen.",
  );
  const transferCoinTransactionHash = await transferCoin(alice, charlie.accountAddress, bob.accountAddress, 100);
  await aptos.waitForTransaction({ transactionHash: transferCoinTransactionHash });
  console.log(`Bob's new StackCoin balance: ${await getStackBalance(bob, metadataAddress)}.`);

  console.log("Alice unfreezes Bob's account.");
  const unfreezeTransactionHash = await unfreeze(alice, bob.accountAddress);
  await aptos.waitForTransaction({ transactionHash: unfreezeTransactionHash });
  console.log("Alice burns 50 coins from Bob.");
  const burnCoinTransactionHash = await burnCoin(alice, bob.accountAddress, 50);
  await aptos.waitForTransaction({ transactionHash: burnCoinTransactionHash });
  console.log(`Bob's new StackCoin balance: ${await getStackBalance(bob, metadataAddress)}.`);

  /// Normal fungible asset transfer between primary stores
  console.log("Bob transfers 10 coins to Alice as the owner.");
  const transferFungibleAssetRawTransaction = await aptos.transferFungibleAsset({
    sender: bob,
    fungibleAssetMetadataAddress: AccountAddress.from(metadataAddress),
    recipient: alice.accountAddress,
    amount: 10,
  });
  const transferFungibleAssetTransaction = await aptos.signAndSubmitTransaction({
    signer: bob,
    transaction: transferFungibleAssetRawTransaction,
  });
  await aptos.waitForTransaction({ transactionHash: transferFungibleAssetTransaction.hash });
  console.log(`Alice's new StackCoin balance: ${await getStackBalance(alice, metadataAddress)}.`);
  console.log(`Bob's new StackCoin balance: ${await getStackBalance(bob, metadataAddress)}.`);
}

main();
