# Glimpsea NEAR checkout contract

`pay()` accepts an exact 0.01 NEAR deposit for a Basic research order. The buyer signs a single payable function call. The contract records a successful payment under its order ID and emits an `order_paid` event. It performs no cross-contract calls during payment.

## Build and test

From this directory, use Rust 1.95 or newer and the `wasm32-unknown-unknown` target.

```sh
rustup target add wasm32-unknown-unknown
RUSTFLAGS="--cfg near" cargo build --locked --release --target wasm32-unknown-unknown
```

The artifact is `target/wasm32-unknown-unknown/release/glimpsea_checkout.wasm`. Run `node contracts/checkout/test-sandbox.mjs` from the repository root with the repository's Node dependencies installed and `near-sandbox@0.3.3` available. Alternatively, set `NEAR_SANDBOX_MODULE` to an absolute path to that package's ESM entry point. The suite starts a local NEAR Sandbox and uses generated keys.

## Contract interface

| Method | Input | Behavior |
| --- | --- | --- |
| `new` | `treasury`, `quote_key`, `deployment_id` | Initialize from the contract account. Use a separate, existing treasury account, a dedicated Ed25519 signing key's public key, and a base64-encoded random 32-byte deployment ID unique to this deployment and network. |
| `pay` | `order_id`, `issued_at_ms`, `expires_at_ms`, `signature` | Accept the exact attached amount from the quoted NEAR account. Time arguments are decimal strings and the signature is standard base64. The order ID is a lowercase canonical UUID v4. |
| `get_payment` | `order_id` | Return the recorded payer, amount in yoctoNEAR, and payment time in milliseconds, or `null`. |
| `get_config` | none | Return the treasury, quote public key, deployment ID, Basic price, and maximum quote lifetime. |
| `withdraw` | `amount` as a yoctoNEAR string | The treasury attaches exactly one yoctoNEAR and can withdraw liquid revenue to itself. A failed native transfer returns to the contract and leaves receipts intact. |

## Quote encoding and settlement

Sign the following Borsh bytes directly with Ed25519. This signing key authorizes quotes and needs no on-chain access key. Keep its private key at the issuer.

| Field | Encoding |
| --- | --- |
| Domain `glimpsea.checkout.quote.v1` | Borsh string |
| Contract account ID | Borsh string |
| Deployment ID | 32 raw bytes |
| Order ID | 16 raw UUID bytes in canonical text order |
| Payer account ID | Borsh string |
| Amount in yoctoNEAR | Little-endian `u128`, fixed at `10000000000000000000000` |
| Issued at in milliseconds | Little-endian `u64` |
| Expires at in milliseconds | Little-endian `u64` |

A Borsh string is a little-endian `u32` byte length followed by UTF-8 bytes. Issue quotes for real orders and use the same order ID if a quote needs refreshing. On-chain checks require `issued_at_ms <= block_time_ms < expires_at_ms` and a maximum lifetime of 15 minutes. A valid quote is scoped to the contract, deployment, buyer and order. Failed payment calls leave no receipt and NEAR returns the attached deposit. The initiating wallet still pays gas.

The backend can query `get_payment` at finality and compare the order ID, payer, amount, and configured checkout account before unlocking research. Keep private research data off-chain. Stored receipts remain public and include only the order ID, payer, payment amount, and time. The deposit covers the receipt's storage. Receipts are retained to prevent a second payment for the same order.

Deploy and initialize atomically on an account dedicated to checkout. Full-access keys on that account retain power to replace code or move funds outside the contract. Remove deployment keys for an immutable deployment, or secure retained upgrade authority separately. The treasury and quote public key are fixed in this implementation. To replace a signing key without upgrading code, use a new checkout deployment and continue reconciling prior orders against the old contract.

The deployed testnet account is [checkout-v1.glimpsea-d15aafd4df.testnet](https://testnet.nearblocks.io/address/checkout-v1.glimpsea-d15aafd4df.testnet). The deployment transaction initialized the contract and deleted its only access key in the same batch. [Deployment receipt](https://testnet.nearblocks.io/txns/5Su2r93x2aDPojpRKmKfmDLJazYoj3VSVrj7Wk612Rrm)
