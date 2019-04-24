const StellarSdk = require("stellar-sdk");

StellarSdk.Network.useTestNetwork();
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');

// Keys for accounts to issue the new asset
const issuingKeys = StellarSdk.Keypair.fromSecret(
  "SDV2I3KG7IDYJV53D3OSFBGJVIBRH4MJXQ57BEKIWSB2Y3FQO45CHMEI"
);

const baseKeys = StellarSdk.Keypair.fromSecret(
  "SBJXDBQAUTGLAFI6E4AJCE7AHA45JGMKXZRNSSCCNZSSMOKSUJQUGWQI"
);

// Create an object to represent the new asset
const everToken = new StellarSdk.Asset(
  "EVER",
  issuingKeys.publicKey()
);

// First, the base account must trust the asset
server
  .loadAccount(baseKeys.publicKey())
  .then(receiver => {
    const transaction = new StellarSdk.TransactionBuilder(receiver)
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: everToken
        })
      ).setTimeout(1000)
      .build();
    transaction.sign(baseKeys);
    return server.submitTransaction(transaction);
  })

  // Second, the issuing account actually sends a payment using the asset
  .then(() => server.loadAccount(issuingKeys.publicKey()))
  .then(issuer => {
    const transaction = new StellarSdk.TransactionBuilder(issuer)
      .addOperation(
        StellarSdk.Operation.payment({
          destination: baseKeys.publicKey(),
          asset: everToken,
          amount: "100"
        })
      ).setTimeout(1000)
      .build();
    transaction.sign(issuingKeys);
    server.submitTransaction(transaction);
    console.info("Asset Issued and trusted by base account");
  })
  .catch(error => {
    console.error("Error!", error);
  });
