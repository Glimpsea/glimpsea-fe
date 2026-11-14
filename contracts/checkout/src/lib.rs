use near_sdk::{
    borsh, env,
    json_types::{Base64VecU8, U64},
    near, require,
    store::LookupMap,
    AccountId, CurveType, NearToken, PanicOnDefault, Promise, PublicKey,
};

const QUOTE_DOMAIN: &str = "glimpsea.checkout.quote.v1";
const PRICE: NearToken = NearToken::from_millinear(10);
const MAX_QUOTE_LIFETIME_MS: u64 = 15 * 60 * 1_000;

#[derive(borsh::BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct Quote<'a> {
    domain: &'a str,
    contract: &'a AccountId,
    deployment_id: &'a [u8; 32],
    order_id: &'a [u8; 16],
    payer: &'a AccountId,
    amount_yocto: u128,
    issued_at_ms: u64,
    expires_at_ms: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Payment {
    payer: AccountId,
    amount: NearToken,
    paid_at_ms: U64,
}

#[near(serializers = [json])]
pub struct Config {
    treasury: AccountId,
    quote_key: PublicKey,
    deployment_id: Base64VecU8,
    basic_price: NearToken,
    max_quote_lifetime_ms: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Checkout {
    treasury: AccountId,
    quote_key: PublicKey,
    deployment_id: [u8; 32],
    payments: LookupMap<[u8; 16], Payment>,
}

#[near]
impl Checkout {
    #[init]
    #[private]
    pub fn new(treasury: AccountId, quote_key: PublicKey, deployment_id: Base64VecU8) -> Self {
        require!(
            treasury != env::current_account_id(),
            "Use a separate treasury account"
        );
        require!(
            quote_key.curve_type() == CurveType::ED25519,
            "Use an Ed25519 quote key"
        );
        let deployment_id: [u8; 32] = deployment_id
            .0
            .try_into()
            .unwrap_or_else(|_| env::panic_str("Deployment ID must be 32 bytes"));
        require!(deployment_id != [0; 32], "Use a nonzero deployment ID");
        Self {
            treasury,
            quote_key,
            deployment_id,
            payments: LookupMap::new(b"p"),
        }
    }

    pub fn get_config(&self) -> Config {
        Config {
            treasury: self.treasury.clone(),
            quote_key: self.quote_key.clone(),
            deployment_id: Base64VecU8(self.deployment_id.to_vec()),
            basic_price: PRICE,
            max_quote_lifetime_ms: U64(MAX_QUOTE_LIFETIME_MS),
        }
    }

    pub fn get_payment(&self, order_id: String) -> Option<Payment> {
        self.payments.get(&parse_order_id(&order_id)).cloned()
    }

    #[payable]
    pub fn pay(
        &mut self,
        order_id: String,
        issued_at_ms: U64,
        expires_at_ms: U64,
        signature: Base64VecU8,
    ) -> Payment {
        let id = parse_order_id(&order_id);
        let payer = env::predecessor_account_id();
        require!(
            payer == env::signer_account_id(),
            "Pay directly from your wallet"
        );
        require!(
            payer != env::current_account_id(),
            "Self-payment is disabled"
        );
        require!(env::attached_deposit() == PRICE, "Attach exactly 0.01 NEAR");
        require!(!self.payments.contains_key(&id), "Order is already paid");

        let now = env::block_timestamp_ms();
        require!(issued_at_ms.0 <= now, "Quote is not active yet");
        require!(now < expires_at_ms.0, "Quote has expired");
        require!(
            expires_at_ms.0 - issued_at_ms.0 <= MAX_QUOTE_LIFETIME_MS,
            "Quote lifetime exceeds 15 minutes"
        );

        let signature = signature
            .0
            .as_slice()
            .try_into()
            .unwrap_or_else(|_| env::panic_str("Signature must be 64 bytes"));
        let contract = env::current_account_id();
        let payload = borsh::to_vec(&Quote {
            domain: QUOTE_DOMAIN,
            contract: &contract,
            deployment_id: &self.deployment_id,
            order_id: &id,
            payer: &payer,
            amount_yocto: PRICE.as_yoctonear(),
            issued_at_ms: issued_at_ms.0,
            expires_at_ms: expires_at_ms.0,
        })
        .unwrap_or_else(|_| env::panic_str("Could not encode quote"));
        // PublicKey stores a one-byte curve tag before the 32-byte key.
        let public_key = self.quote_key.as_bytes()[1..]
            .try_into()
            .unwrap_or_else(|_| env::panic_str("Invalid quote key"));
        require!(
            env::ed25519_verify(signature, payload, public_key),
            "Invalid quote signature"
        );

        let payment = Payment {
            payer,
            amount: PRICE,
            paid_at_ms: U64(now),
        };
        let storage_before = env::storage_usage();
        self.payments.insert(id, payment.clone());
        self.payments.flush();
        let bytes_written = env::storage_usage() - storage_before;
        let storage_cost = env::storage_byte_cost().as_yoctonear() * u128::from(bytes_written);
        require!(
            storage_cost <= PRICE.as_yoctonear(),
            "Payment does not cover receipt storage"
        );
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": "glimpsea_checkout",
                "version": "1.0.0",
                "event": "order_paid",
                "data": [{
                    "order_id": order_id,
                    "payer": payment.payer,
                    "amount": payment.amount,
                    "paid_at_ms": payment.paid_at_ms,
                }],
            })
        ));
        payment
    }

    #[payable]
    pub fn withdraw(&mut self, amount: NearToken) -> Promise {
        require!(
            env::predecessor_account_id() == self.treasury,
            "Only the treasury may withdraw"
        );
        near_sdk::assert_one_yocto();
        require!(amount > NearToken::ZERO, "Withdraw a positive amount");
        let reserve = env::storage_byte_cost().as_yoctonear() * u128::from(env::storage_usage());
        let available = env::account_balance()
            .as_yoctonear()
            .saturating_sub(reserve);
        require!(
            amount.as_yoctonear() <= available,
            "Insufficient liquid balance"
        );
        // A failed native transfer returns the tokens to the contract. It changes no receipt state.
        Promise::new(self.treasury.clone()).transfer(amount)
    }
}

fn parse_order_id(order_id: &str) -> [u8; 16] {
    let input = order_id.as_bytes();
    require!(input.len() == 36, "Use a canonical UUID v4");
    require!(
        input[14] == b'4' && matches!(input[19], b'8' | b'9' | b'a' | b'b'),
        "Use a canonical UUID v4"
    );
    let mut id = [0; 16];
    let mut digits = 0;
    for (index, byte) in input.iter().copied().enumerate() {
        if matches!(index, 8 | 13 | 18 | 23) {
            require!(byte == b'-', "Use a canonical UUID v4");
            continue;
        }
        let digit = match byte {
            b'0'..=b'9' => byte - b'0',
            b'a'..=b'f' => byte - b'a' + 10,
            _ => env::panic_str("Use a canonical UUID v4"),
        };
        id[digits / 2] = (id[digits / 2] << 4) | digit;
        digits += 1;
    }
    id
}
