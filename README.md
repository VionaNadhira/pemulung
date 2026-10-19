# 🤖 BNB Chain Discord Bot

Bot Discord untuk melakukan transaksi onchain di jaringan **BNB Chain (BSC)** langsung dari Discord. Mendukung kirim BNB, USDT, USDC, FDUSD, WBNB, cek saldo, riwayat transaksi, serta ekspor laporan PDF otomatis.

---

## ✨ Fitur

| Command | Deskripsi |
|---|---|
| `/balance` | Cek saldo BNB & semua token (wallet bot atau alamat lain) |
| `/send` | Kirim BNB atau token ke alamat tujuan (ada konfirmasi + nota PDF) |
| `/send-bulk` | Kirim token ke banyak alamat sekaligus (maks 50, ada laporan PDF) |
| `/tx` | Lihat riwayat 20 transaksi token terakhir (ada ekspor PDF) |
| `/wallet` | Tampilkan alamat wallet bot untuk deposit |
| `/tokens` | Lihat daftar token yang didukung |
| `/help` | Tampilkan semua perintah |

---

## 📄 Laporan PDF

Setiap transaksi menghasilkan laporan PDF otomatis yang di-attach ke Discord:

- **`/send`** → nota transaksi (`nota-<hash>.pdf`) berisi detail transfer, TX hash, block, gas
- **`/send-bulk`** → laporan massal (`bulk-<timestamp>.pdf`) berisi summary + daftar penerima
- **`/tx`** → riwayat transaksi (`tx-history-<timestamp>.pdf`) berisi daftar transaksi wallet

---

## 🪙 Token yang Didukung (BSC Mainnet)

| Token | Contract Address | Catatan |
|---|---|---|
| BNB | Native | Gas fee & native coin |
| USDT | `0x55d398326f99059fF775485246999027B3197955` | Binance-Peg USDT |
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | Binance-Peg USDC |
| FDUSD | `0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409` | First Digital USD (pengganti BUSD) |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` | Wrapped BNB |

> ⚠️ BUSD sudah deprecated sejak Februari 2024 (Paxos berhenti mint, Binance stop support). FDUSD adalah penggantinya di BSC.

---

## 📋 Prasyarat

- [Node.js](https://nodejs.org/) v18 atau lebih baru
- Akun [Discord Developer Portal](https://discord.com/developers/applications)
- Wallet BNB Chain dengan saldo BNB untuk gas fee

---

## 🚀 Instalasi

### 1. Clone & Install

```bash
git clone <repo-url>
cd bnb-discord-bot
npm install
```

### 2. Konfigurasi `.env`

```bash
cp .env.example .env
```

Edit file `.env` dan isi semua variabel:

```env
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id   # kosongkan untuk global deploy

# BNB Chain
WALLET_PRIVATE_KEY=your_private_key
BNB_RPC_URL=https://bsc-dataseed.binance.org/

# Token contracts (sudah terisi default mainnet)
USDT_CONTRACT=0x55d398326f99059fF775485246999027B3197955
USDC_CONTRACT=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
FDUSD_CONTRACT=0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409
WBNB_CONTRACT=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c

# Bot Settings
IS_TESTNET=false
```

### 3. Buat Discord Bot

1. Buka [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. Masuk ke tab **Bot** → **Reset Token** → salin token ke `DISCORD_TOKEN`
3. Tab **OAuth2** → **URL Generator**:
   - Scope: `bot` + `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`, `Attach Files`
4. Salin URL yang dihasilkan dan undang bot ke server kamu

> **Note:** Permission `Attach Files` wajib agar bot bisa mengirim nota PDF.

### 4. Deploy Slash Commands

```bash
npm run deploy-commands
```

> Jika `DISCORD_GUILD_ID` diisi → commands aktif **langsung** (cocok untuk development).
> Jika kosong → deploy global, butuh **~1 jam** untuk aktif.

### 5. Jalankan Bot

```bash
# Production
npm start

# Development (auto-restart saat file berubah)
npm run dev
```

---

## 📁 Struktur Project

```
bnb-discord-bot/
├── src/
│   ├── commands/
│   │   ├── balance.js      # Cek saldo semua token
│   │   ├── send.js         # Kirim token (single + nota PDF)
│   │   ├── send-bulk.js    # Kirim massal (bulk + laporan PDF)
│   │   ├── tx.js           # Riwayat 20 transaksi terakhir (+ ekspor PDF)
│   │   ├── wallet.js       # Info wallet bot
│   │   ├── tokens.js       # Daftar token
│   │   └── help.js         # Bantuan
│   ├── config/
│   │   └── tokens.js       # Konfigurasi token & contract address
│   ├── abi/
│   │   └── erc20.js        # ABI standar ERC20/BEP20
│   ├── utils/
│   │   ├── blockchain.js   # Helper ethers.js (provider, wallet, tx)
│   │   ├── format.js       # Format angka
│   │   └── pdf.js          # Generator laporan PDF
│   ├── index.js            # Entry point bot
│   └── deploy-commands.js  # Script deploy slash commands
├── .env.example
├── .gitignore
└── package.json
```

---

## 💡 Penggunaan

### Cek Saldo
```
/balance                          → saldo wallet bot (semua token)
/balance address:0x123...         → saldo alamat lain
```

### Kirim Token (Single)
```
/send to:0xAlamatTujuan token:USDT amount:10
/send to:0xAlamatTujuan token:BNB amount:0.05
```
> Bot menampilkan preview + tombol **Konfirmasi** / **Batalkan**. Setelah transaksi selesai, nota PDF otomatis di-attach.

### Kirim Token (Bulk)
```
/send-bulk token:USDT amount:10 addresses:0xABC...,0xDEF...,0x123...
```
> Kirim **10 USDT** ke setiap alamat dalam daftar. Maksimal 50 alamat. Laporan PDF berisi summary + daftar penerima otomatis di-attach.

### Cek Riwayat Transaksi
```
/tx                                → 20 transaksi terakhir wallet bot
/tx address:0xAlamatTujuan         → 20 transaksi terakhir alamat tertentu
```
> Menampilkan riwayat transfer token (masuk & keluar) dalam 196.000 block terakhir (~25 jam, karena block time BSC kini ~0,46 detik). Riwayat PDF otomatis di-attach.

---

## ⚠️ Keamanan

- **Jangan commit file `.env`** — sudah ditambahkan ke `.gitignore`
- Private key wallet bot hanya digunakan untuk menandatangani transaksi
- Bot tidak menyimpan atau membagikan private key melalui Discord
- Pastikan hanya pengguna terpercaya yang bisa menggunakan command `/send`
- Pertimbangkan menambahkan role-based access control untuk command sensitif

---

## 📦 Dependencies

| Package | Versi | Kegunaan |
|---|---|---|
| `discord.js` | ^14 | Discord bot framework |
| `ethers` | ^6 | Interaksi dengan BNB Chain |
| `dotenv` | ^16 | Konfigurasi environment variables |
| `pdfkit` | ^0.20 | Generate laporan PDF |

---

## 🔧 Konfigurasi Testnet

Untuk menggunakan BSC Testnet:

```env
BNB_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
IS_TESTNET=true

# Token testnet (dapatkan dari faucet)
USDT_CONTRACT=<testnet_usdt_address>
USDC_CONTRACT=<testnet_usdc_address>
```

Faucet BSC Testnet: https://testnet.bnbchain.org/faucet-smart

---

## 🤝 Menambah Token Baru

Edit `src/config/tokens.js`:

```js
MY_TOKEN: {
  symbol: "MYT",
  name: "My Token",
  decimals: 18,
  contract: "0xContractAddress...",
  isNative: false,
  logo: "🔵",
},
```

Lalu tambahkan choices di command `send.js` dan `send-bulk.js`.
