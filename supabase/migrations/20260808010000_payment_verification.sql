-- Payment verification: track confirmations and make tx hashes findable.

alter table payments
  add column if not exists confirmations integer not null default 0;

create index if not exists payments_tx_hash_idx on payments (tx_hash);
