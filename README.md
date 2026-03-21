<p align="center">
  <h1 align="center">🌾 KilimoKinga</h1>
  <p align="center">
    <strong>Decentralized Parametric Crop Insurance for African Smallholder Farmers</strong>
  </p>
</p>

---

##  Overview

**KilimoKinga** (Swahili for *"Farming Protector"*) is a blockchain-powered parametric crop insurance platform purpose-built for Kenyan and African smallholder farmers. It replaces the slow, opaque traditional claims process with **AI-driven weather agents** that trigger instant, transparent payouts the moment climate thresholds are breached—drought, flooding, or extreme heat.

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

## Contact

- **GitHub**: [github.com/siqah/kilimoKinga](https://github.com/siqah/kilimoKinga)
- **Issues**: [github.com/siqah/kilimoKinga/issues](https://github.com/siqah/kilimoKinga/issues)

---

<p align="center">
  <strong>Built  for African farmers</strong><br/>
  <em>Protecting livelihoods, one season at a time.</em>
</p>
