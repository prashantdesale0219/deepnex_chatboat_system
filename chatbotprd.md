# 🧠 Chatbot + Inventory Management System — PRD (Backend Only)

## 📌 Overview

This PRD defines the backend system for a web-based chatbot platform where admins can configure purpose-specific bots. These bots can answer end-user inventory queries in real-time, such as checking product availability, accepting quantities, and recording simple orders.

---

## 🎯 Objectives

* Enable inventory-aware chatbots for specific business use-cases.
* Allow chatbot to respond to queries like "XYZ product available hai?" and handle basic order intents.
* Maintain inventory per bot/business (multi-tenant design).
* Support both manual entry and CSV upload of inventory by admins.

---

## 🏗️ Tech Stack

* **Backend:** Node.js + Express (No TypeScript)
* **Database:** MongoDB (Mongoose ODM)
* **LLM Layer:** Mistral API (for intent + entity extraction)
* **Authentication:** JWT (Admin API)

---

## 🧱 Data Models

### 1. `BotConfig`

```js
{
  botId: String,
  businessName: String,
  purpose: String,
  inventoryEnabled: Boolean,
  createdBy: ObjectId // admin user
}
```

### 2. `ProductInventory`

```js
{
  botId: String, // FK to BotConfig
  productName: String,
  sku: String,
  availableStock: Number,
  unit: String // e.g., "pcs", "kg"
}
```

### 3. `OrderRequest`

```js
{
  botId: String,
  productName: String,
  requestedQty: Number,
  userQuery: String,
  timestamp: Date,
  status: String // pending / confirmed / rejected
}
```

---

## 📡 API Endpoints

### 🔐 Admin APIs

#### `POST /api/admin/bot`

Create a new chatbot config.

#### `POST /api/admin/inventory/upload`

CSV upload route (headers: productName, sku, availableStock, unit)

#### `POST /api/admin/inventory/add`

Add single inventory item.

#### `PATCH /api/admin/inventory/update-stock`

Update stock for a specific product (by botId + sku).

### 🤖 Chatbot APIs

#### `GET /api/chat/inventory/check?botId=xyz123&query=led+bulb`

Return closest matching product and its stock.

#### `POST /api/chat/inventory/order`

Record user order intent.

```json
{
  "botId": "xyz123",
  "productName": "LED Bulb",
  "requestedQty": 10,
  "userQuery": "LED bulb 10 piece chahiye"
}
```

---

## 🧠 Conversation Flow Logic

1. **Detect Product Query:**

   * Mistral detects intent: "inventory\_check"
   * Extract product name (e.g., "LED bulb")

2. **Check Stock:**

   * Query ProductInventory using fuzzy text match

3. **Bot Reply:**

   * Product found: "Haan, 54 pieces available hain. Kitne chahiye?"
   * Product not found: "Mujhe woh item nahi mil raha. Naam sahi batayein."

4. **Take Order:**

   * Capture quantity → Call `/chat/inventory/order` endpoint

5. **Confirm Back:**

   * "10 pcs reserve kiya gaya. Jaldi contact kiya jayega."

---

## 🧩 Integration Notes

* Each chatbot is scoped by `botId` in DB & APIs.
* Middleware for `botId` validation.
* Use `fuzzy-search` or regex for matching product queries.
* Add admin notification hook on new order intents (email or dashboard alert).

---

## 🚀 Future Scope

* Payment gateway integration
* Stock analytics reports (admin panel)
* Multi-language bot replies (based on user language detection)

---

## 📅 Milestones

| Day   | Task                                   |
| ----- | -------------------------------------- |
| 1-2   | Setup DB models, Mongo config          |
| 3-5   | Admin bot & inventory APIs             |
| 6-8   | Chatbot inventory check logic          |
| 9-10  | Order request API & webhook            |
| 11-12 | Testing, debugging                     |
| 13-14 | Final deployment + admin CSV dashboard |
