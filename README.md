<p align="center">
  <h1 align="center">🌾 KilimoKinga</h1>
  <p align="center">
    <strong>Decentralized Parametric Crop Insurance for African Smallholder Farmers</strong>
  </p>
  <p align="center">
    <a href="https://github.com/siqah/kilimoKinga/issues"><img src="https://img.shields.io/github/issues/siqah/kilimoKinga" alt="Issues" /></a>
    <a href="https://github.com/siqah/kilimoKinga"><img src="https://img.shields.io/github/stars/siqah/kilimoKinga?style=social" alt="Stars" /></a>
    <img src="https://img.shields.io/badge/Solidity-^0.8.24-363636?logo=solidity" alt="Solidity" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React" />
    <img src="https://img.shields.io/badge/License-ISC-blue" alt="License" />
  </p>
</p>

---

## 📌 Overview

**KilimoKinga** (Swahili for *"Farming King"*) is a blockchain-powered parametric crop insurance platform purpose-built for Kenyan and African smallholder farmers. It replaces the slow, opaque traditional claims process with **AI-driven weather agents** that trigger instant, transparent payouts the moment climate thresholds are breached—drought, flooding, or extreme heat.

> *Over 80% of African farming is rain-fed. A single bad season can wipe out a family's livelihood. KilimoKinga ensures that when disaster strikes, financial support arrives automatically—no paperwork, no delays.*

### Why KilimoKinga?

| Problem | KilimoKinga Solution |
|---|---|
| Traditional insurance requires lengthy claims & proof of loss | **Parametric triggers** — payouts fire automatically when weather data crosses thresholds |
| Farmers lack access to banks or digital wallets | **M-Pesa integration** — pay premiums & receive payouts via mobile money |
| Opacity in how payouts are calculated | **On-chain transparency** — every policy, premium, and payout is verifiable on the blockchain |
| No coverage for smallholder farmers | **Micro-premiums** with region-specific policies and loyalty discounts |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)             │
│   Dashboard │ Register │ Stake │ Admin │ Insights       │
└────────────────────────┬────────────────────────────────┘
                         │  ethers.js / REST API
┌────────────────────────┴────────────────────────────────┐
│                  BACKEND (Express + MongoDB)             │
│    Routes │ Services │ Blockchain Listeners │ M-Pesa     │
└────────────────────────┬────────────────────────────────┘
                         │  ethers.js
┌────────────────────────┴────────────────────────────────┐
│               SMART CONTRACTS (Solidity ^0.8.24)        │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ FarmerInsurance   │  │  WeatherOracle   │             │
│  │ (Core Engine)     │◄─┤  (Chainlink-     │             │
│  │                   │  │   ready)         │             │
│  └────────┬──────────┘  └──────────────────┘             │
│           │                                              │
│  ┌────────┴──────────┐  ┌──────────────────┐             │
│  │  MpesaBridge      │  │  InsurancePool   │             │
│  │  (Mobile Money)   │  │  (Investor       │             │
│  │                   │  │   Liquidity)     │             │
│  └───────────────────┘  └──────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🔗 Smart Contracts

- **FarmerInsurance** — Core parametric engine with multi-season policies, tiered payouts (full & partial), NDVI satellite vegetation checks, and loyalty discounts (up to 25% off premiums)
- **WeatherOracle** — Chainlink-ready oracle with request/fulfill pattern, admin fallback for manual data injection, and staleness guards (7-day max age)
- **MpesaBridge** — Bridges M-Pesa (via Paystack STK Push) to on-chain registration; maps phone hashes to wallets so payouts route back to mobile money
- **InsurancePool** — Stablecoin-backed liquidity pool where investors stake and earn 5% APY; funds are used to cover farmer claim payouts
- **Gas Optimized** — Custom errors, packed structs, and efficient storage patterns throughout

### 🖥️ Frontend (React 18 + Vite)

- **Dashboard** — Real-time view of a farmer's policy, coverage, claim status, and loyalty tier
- **Register** — Region selection, premium calculation with discount preview, and on-chain registration
- **Stake** — Investor interface to stake stablecoins into the insurance pool and track rewards
- **Admin Panel** — Policy configuration, oracle management, season control, and claim triggers
- **Insights** — Analytics and risk metrics across regions

### ⚙️ Backend (Express + MongoDB)

- RESTful API bridging the frontend to blockchain
- M-Pesa/Paystack STK Push integration for mobile money premium collection
- On-chain event listeners for real-time claim and registration monitoring
- MongoDB for persistent storage, analytics, and fast data retrieval

---

## 📂 Project Structure

```
kilimoKinga/
├── contracts/                  # Solidity smart contracts
│   ├── FarmerInsurance.sol     # Core parametric insurance engine
│   ├── WeatherOracle.sol       # Chainlink-ready weather data oracle
│   ├── MpesaBridge.sol         # M-Pesa ↔ blockchain bridge
│   ├── InsurancePool.sol       # Investor-backed liquidity pool
│   ├── MockUSDC.sol            # Test stablecoin for development
│   └── MockWeatherOracle.sol   # Mock oracle for testing
├── scripts/
│   ├── deploy.js               # Standard deployment script
│   └── deploy-proxy.js         # UUPS proxy deployment (upgradeable)
├── test/                       # Hardhat test suite
├── backend/
│   ├── server.js               # Express entry point
│   ├── prisma/                 # Database schema
│   └── src/
│       ├── routes/             # API routes
│       ├── services/           # Business logic (risk, registration)
│       ├── controllers/        # Request handlers
│       ├── listeners/          # Blockchain event listeners
│       ├── db/                 # Database connection
│       ├── middleware/         # Express middleware
│       └── utils/              # Helpers & utilities
├── frontend/
│   ├── index.html              # Entry point
│   ├── vite.config.js          # Vite configuration
│   └── src/
│       ├── App.jsx             # Root component & routing
│       ├── Web3Provider.jsx    # Wallet connection context
│       ├── contracts.js        # ABI & contract addresses
│       ├── index.css           # Design system
│       └── pages/
│           ├── Dashboard.jsx   # Farmer dashboard
│           ├── Register.jsx    # Policy registration
│           ├── Stake.jsx       # Investor staking
│           ├── Admin.jsx       # Admin panel
│           └── Insights.jsx    # Analytics & risk metrics
├── hardhat.config.js           # Hardhat configuration
└── package.json                # Root dependencies
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **MetaMask** or any Web3-compatible wallet
- **MongoDB** instance (local or Atlas)

### 1. Clone the Repository

```bash
git clone https://github.com/siqah/kilimoKinga.git
cd kilimoKinga
```

### 2. Install Dependencies

```bash
# Root (Hardhat & contracts)
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Configure Environment

Create a `.env` file in the `backend/` directory (see `.env.example` for reference):

```env
# Blockchain
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=your_deployer_private_key

# Database
MONGODB_URI=mongodb://localhost:27017/kilimokinga

# M-Pesa / Paystack
PAYSTACK_SECRET_KEY=your_paystack_key
```

### 4. Start a Local Blockchain

```bash
npx hardhat node
```

### 5. Deploy Contracts

```bash
# Standard deployment
npx hardhat run scripts/deploy.js --network localhost

# OR upgradeable proxy deployment
npx hardhat run scripts/deploy-proxy.js --network localhost
```

### 6. Run the Application

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:3000`.

---

## 🔐 Smart Contract Details

### Claim Trigger Flow

```
Weather Event (drought/heat/crop damage)
        │
        ▼
WeatherOracle updates regional data
        │
        ▼
Admin calls checkAndPayClaim(farmerAddress)
        │
        ▼
Contract reads oracle data & compares to policy thresholds
        │
        ├── Severe breach (≥ threshold%) → Full payout (100% coverage)
        ├── Moderate breach              → Partial payout (configurable %)
        └── No breach                    → No payout
        │
        ▼
ETH transferred to farmer / MpesaBridge event emitted
```

### Loyalty Program

| Seasons Completed | Discount |
|---|---|
| 0–2 | 0% |
| 3 | 5% |
| 4 | 10% |
| 5 | 15% |
| 6 | 20% |
| 7+ | 25% (max) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity ^0.8.24, Hardhat, OpenZeppelin, Chainlink |
| Frontend | React 18, Vite 5, ethers.js 6, React Router 6 |
| Backend | Node.js, Express 4, MongoDB (Mongoose 9) |
| Payments | Paystack (M-Pesa STK Push) |
| Deployment | Hardhat, UUPS Proxy Pattern (OpenZeppelin Upgrades) |

---

## 🗺️ Roadmap

- [x] Core parametric insurance smart contracts
- [x] Weather oracle with Chainlink-ready architecture
- [x] M-Pesa bridge for mobile money integration
- [x] Investor liquidity pool with staking rewards
- [x] React frontend with dashboard, registration, and admin panel
- [x] MongoDB backend with event listeners
- [ ] Mainnet deployment on Polygon / Arbitrum
- [ ] Live Chainlink oracle integration
- [ ] Mobile-first PWA for feature phone compatibility
- [ ] Multi-language support (Swahili, English, French)
- [ ] SMS/USSD interface for farmers without smartphones
- [ ] Formal smart contract audit

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**. See the [LICENSE](LICENSE) file for details.

---

## 📬 Contact

- **GitHub**: [github.com/siqah/kilimoKinga](https://github.com/siqah/kilimoKinga)
- **Issues**: [github.com/siqah/kilimoKinga/issues](https://github.com/siqah/kilimoKinga/issues)

---

<p align="center">
  <strong>Built with ❤️ for African farmers</strong><br/>
  <em>Protecting livelihoods, one season at a time.</em>
</p>
