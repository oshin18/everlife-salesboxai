'use strict'
const cote = require('cote');
const stellarBase = require("stellar-base");
const StellarSdk = require('stellar-sdk');
StellarSdk.Network.useTestNetwork();
var server = new StellarSdk.Server('https://horizon-testnet.stellar.org');

const sender = {
    public: "GAKHTFWLT34TFKZUP2P5RV5F2SA3OTU3CA4WUDGUX7FWG2NABQWQ7MZ5",
    secret: "SCLUONDHOO3YD5HU4ANRZGCC762NNWZJHWK4MISF6AWIZNPEPTXUO6XY"
}
var sourceKeys = StellarSdk.Keypair.fromSecret(sender.secret);

const issuingKeys = StellarSdk.Keypair.fromSecret(
    "SDV2I3KG7IDYJV53D3OSFBGJVIBRH4MJXQ57BEKIWSB2Y3FQO45CHMEI"
);

// Create an object to represent the new asset
const everToken = new StellarSdk.Asset(
    "EVER",
    issuingKeys.publicKey()
);


/*      understand/
 * This is the main entry point where we start.
 *
 *      outcome/
 * Start our microservice.
 */
function main() {
    startMicroservice()
    registerWithCommMgr()
}

/* microservice key (identity of the microservice) */
let msKey = 'everlife-stellar-transfer'

const commMgrClient = new cote.Requester({
    name: 'Calculator -> CommMgr',
    key: 'everlife-communication-svc',
})

function sendReply(msg, req) {
    req.type = 'reply'
    req.msg = String(msg)
    commMgrClient.send(req, (err) => {
        if (err) u.showErr(err)
    })
}
function startMicroservice() {

    /*      understand/
     * The microservice (partitioned by key to prevent
     * conflicting with other services).
     */
    const svc = new cote.Responder({
        name: 'Everlife Stellar Transfer Skill',
        key: msKey,
    })

    /*      outcome/
     * Respond to user messages asking us to code/decode things
     */
    svc.on('msg', (req, cb) => {

        if (req.msg && req.msg.startsWith('/tip ')) {
            cb(null, true) /* Yes I am handling this message */
            let split = req.msg.split(" ");
            if (split.length === 3) {
                let address = split[1];
                if (stellarBase.StrKey.isValidEd25519PublicKey(address)) {
                    let amount = Number(split[2]);
                    if (Number.isInteger(amount)) {
                        if (transfer(address, amount)) {
                            sendReply('Your stellar account is debited with ' + amount + 'EVER tokens', req);
                        } else {
                            sendReply('Something went wrong', req);
                        }
                    } else {
                        sendReply('Invalid amount. It must be integer', req);
                    }
                } else {
                    sendReply('Invalid stellar address', req);
                }
            } else {
                sendReply('Enter stellar address and amount for transfer', req);
            }
        } else {
            cb() /* REMEMBER TO CALL THIS OTHERWISE THE AVATAR WILL WAIT FOR A RESPONSE FOREVER */
        }
    })
    function transfer(destinationId, amount) {

        // Transaction will hold a built transaction we can resubmit if the result is unknown.
        var transaction;

        // First, check to make sure that the destination account exists.
        // You could skip this, but if the account does not exist, you will be charged
        // the transaction fee when the transaction fails.
        server.loadAccount(destinationId)
            // If the account is not found, surface a nicer error message for logging.
            .catch(StellarSdk.NotFoundError, function (error) {
                return false;
            })
            // If there was no error, load up-to-date information on your account.
            .then(function () {
                return server.loadAccount(sourceKeys.publicKey());
            })
            .then(function (sourceAccount) {
                // Start building the transaction.
                transaction = new StellarSdk.TransactionBuilder(sourceAccount)
                    .addOperation(StellarSdk.Operation.payment({
                        destination: destinationId,
                        asset: everToken,
                        amount: amount
                    }))
                    // A memo allows you to add your own metadata to a transaction. It's
                    // optional and does not affect how Stellar treats the transaction.
                    .addMemo(StellarSdk.Memo.text('Test Transaction'))
                    // Wait a maximum of three minutes for the transaction
                    .setTimeout(180)
                    .build();
                // Sign the transaction to prove you are actually the person sending it.
                transaction.sign(sourceKeys);
                // And finally, send it off to Stellar!
                return server.submitTransaction(transaction);
            })
            .then(function (result) {
                return true;
            })
            .catch(function (error) {
                return false;
            });
    }
}

function registerWithCommMgr() {
    commMgrClient.send({
        type: 'register-msg-handler',
        mskey: msKey,
        mstype: 'msg',
        mshelp: [{ cmd: '/tip', txt: 'Send stellar token(EVER) to another avatar!' }],
    }, (err) => {
        if (err) u.showErr(err)
    })
}
main()