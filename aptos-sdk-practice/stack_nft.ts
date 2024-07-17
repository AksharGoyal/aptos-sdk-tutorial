import { Account, Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const INITIAL_BALANCE = 100_000_000;

const APTOS_NETWORK: Network = Network.DEVNET;
const config = new AptosConfig({ network: APTOS_NETWORK });
const aptos = new Aptos(config);

const quest2 = async () => {
  console.log(
    "This code will create and fund Alice and Bob. Alice will create a collection and a digital asset in that collection and transfer it to Bob.",
  );

  const alice = Account.generate();
  const bob = Account.generate();

  console.log("== Addresses ==\n");
  console.log(`Alice's address is: ${alice.accountAddress}`);

  // Fund and create the accounts
  await aptos.faucet.fundAccount({
    accountAddress: alice.accountAddress,
    amount: INITIAL_BALANCE,
  });
  await aptos.faucet.fundAccount({
    accountAddress: bob.accountAddress,
    amount: INITIAL_BALANCE,
  });

  const collectionName = "StackUp Collection";
  const collectionDescription = "This is a sample collection of the StackUp NFTs";
  const collectionURI = "aptos.dev";

  const createCollectionTransaction = await aptos.createCollectionTransaction({
    creator: alice,
    description: collectionDescription,
    name: collectionName,
    uri: collectionURI,
  });

  console.log("\n== Create the collection ==\n");
  let committedTxn = await aptos.signAndSubmitTransaction({ signer: alice, transaction: createCollectionTransaction });
  let pendingTxn = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

  const alicesCollection = await aptos.getCollectionData({
    creatorAddress: alice.accountAddress,
    collectionName,
    minimumLedgerVersion: BigInt(pendingTxn.version),
  });
  console.log(`Alice's collection: ${JSON.stringify(alicesCollection, null, 4)}`);

  const tokenName = "Asset 1";
  const tokenDescription = "This is the first asset of the token collection";
  const tokenURI = "stackup.dev/asset";

  console.log("\n== Alice Mints the digital asset ==\n");

  const mintTokenTransaction = await aptos.mintDigitalAssetTransaction({
    creator: alice,
    collection: collectionName,
    description: tokenDescription,
    name: tokenName,
    uri: tokenURI,
  });

  committedTxn = await aptos.signAndSubmitTransaction({ signer: alice, transaction: mintTokenTransaction });
  pendingTxn = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

  const alicesDigitalAsset = await aptos.getOwnedDigitalAssets({
    ownerAddress: alice.accountAddress,
    minimumLedgerVersion: BigInt(pendingTxn.version),
  });
  console.log(`Alice's digital assets balance: ${alicesDigitalAsset.length}`);
  console.log(`Alice's digital asset: ${JSON.stringify(alicesDigitalAsset[0], null, 4)}`);
  
  console.log("\n== Transfer the digital asset to Bob ==\n");
  const transferTransaction = await aptos.transferDigitalAssetTransaction({
    sender: alice,
    digitalAssetAddress: alicesDigitalAsset[0].token_data_id,
    recipient: bob.accountAddress,
  });
  committedTxn = await aptos.signAndSubmitTransaction({ signer: alice, transaction: transferTransaction });
  pendingTxn = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

  const alicesDigitalAssetsAfter = await aptos.getOwnedDigitalAssets({
    ownerAddress: alice.accountAddress,
    minimumLedgerVersion: BigInt(pendingTxn.version),
  });
  console.log(`Alices's digital assets balance: ${alicesDigitalAssetsAfter.length}`);

  const bobDigitalAssetsAfter = await aptos.getOwnedDigitalAssets({
    ownerAddress: bob.accountAddress,
    minimumLedgerVersion: BigInt(pendingTxn.version),
  });
  console.log(`Bob's digital assets balance: ${bobDigitalAssetsAfter.length}`);
};

quest2();